"""Driver registry router: conductores con iButton obligatorio.

A driver always has an iButton (card_type=IBUTTON, fixed). When a driver is
assigned to a vehicle, the iButton add command (144) is sent to the tracker
via istarmap; on reassignment, remove (145) is sent to the old vehicle.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import CommandLog, CommandStatus, DeviceCache, DriverRegistry, User
from app.schemas import DriverRegistryCreate, DriverRegistryResponse, DriverRegistryUpdate

router = APIRouter(prefix="/ibuttons/drivers", tags=["ibuttons"])
logger = logging.getLogger(__name__)

CMD_ADD_IBUTTON = 144
CMD_REMOVE_IBUTTON = 145


async def _send_ibutton_command(
    client: IstarmapClient,
    db: AsyncSession,
    user: User,
    imei: str,
    ibutton_id: str,
    command_type: int,
) -> CommandLog:
    """Send an iButton command via istarmap and log it."""
    log = CommandLog(
        user_id=user.id,
        device_imei=imei,
        command_type=command_type,
        ibutton_id=ibutton_id,
        status=CommandStatus.pending,
    )
    db.add(log)
    await db.flush()
    await db.refresh(log)
    try:
        result = await client.send_command(imei, command_type, params={"ibuttonId": ibutton_id})
        log.status = CommandStatus.sent
        log.result_data = result
    except Exception as exc:
        log.status = CommandStatus.failed
        log.result_data = {"error": str(exc)}
        logger.warning("iButton command %d for %s failed: %s", command_type, imei, exc)
    await db.flush()
    await db.refresh(log)
    return log


async def _validate_vehicle(db: AsyncSession, imei: str | None) -> None:
    if imei:
        res = await db.execute(select(DeviceCache).where(DeviceCache.imei == imei))
        if not res.scalar_one_or_none():
            raise HTTPException(404, detail=f"Vehicle with IMEI {imei} not found")


@router.get("/", response_model=list[DriverRegistryResponse])
async def list_drivers(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List registered drivers (each with their iButton)."""
    query = select(DriverRegistry, DeviceCache.device_name).outerjoin(
        DeviceCache, DriverRegistry.device_imei == DeviceCache.imei
    ).order_by(DriverRegistry.full_name)
    if not include_inactive:
        query = query.where(DriverRegistry.is_active == True)  # noqa: E712
    result = await db.execute(query)
    rows = []
    for driver, dev_name in result.all():
        resp = DriverRegistryResponse.model_validate(driver)
        resp.device_name = dev_name
        rows.append(resp)
    return rows


@router.post("/", response_model=DriverRegistryResponse, status_code=status.HTTP_201_CREATED)
async def create_driver(
    body: DriverRegistryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Create a driver. iButton ID is mandatory (a driver without an iButton
    cannot exist). If a vehicle is assigned, sends the add-iButton command (144)
    to the tracker."""
    if not body.ibutton_id or len(body.ibutton_id) < 2:
        raise HTTPException(400, detail="ibutton_id is mandatory (min 2 chars)")

    await _validate_vehicle(db, body.device_imei)

    dup = await db.execute(select(DriverRegistry).where(DriverRegistry.ibutton_id == body.ibutton_id))
    if dup.scalar_one_or_none():
        raise HTTPException(409, detail=f"iButton {body.ibutton_id} already registered to another driver")

    driver = DriverRegistry(
        full_name=body.full_name,
        ibutton_id=body.ibutton_id,
        device_imei=body.device_imei,
        phone=body.phone,
        document=body.document,
        expiry=body.expiry,
        notes=body.notes,
        card_type="IBUTTON",
        updated_at=datetime.now(timezone.utc),
    )
    db.add(driver)
    await db.flush()
    await db.refresh(driver)

    # program the iButton into the tracker
    if driver.device_imei:
        await _send_ibutton_command(
            client, db, current_user, driver.device_imei, driver.ibutton_id, CMD_ADD_IBUTTON
        )

    resp = DriverRegistryResponse.model_validate(driver)
    dev = await db.execute(select(DeviceCache).where(DeviceCache.imei == driver.device_imei))
    d = dev.scalar_one_or_none()
    resp.device_name = d.device_name if d else None
    return resp


@router.put("/{driver_id}", response_model=DriverRegistryResponse)
async def update_driver(
    driver_id: int,
    body: DriverRegistryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Update a driver. If the iButton changes or the vehicle is reassigned,
    the tracker commands are sent accordingly."""
    result = await db.execute(select(DriverRegistry).where(DriverRegistry.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail=f"Driver {driver_id} not found")

    await _validate_vehicle(db, body.device_imei)

    old_imei = driver.device_imei
    old_ibutton = driver.ibutton_id
    updates = body.model_dump(exclude_unset=True)

    if "ibutton_id" in updates and updates["ibutton_id"]:
        if updates["ibutton_id"] != old_ibutton:
            dup = await db.execute(
                select(DriverRegistry).where(DriverRegistry.ibutton_id == updates["ibutton_id"])
            )
            if dup.scalar_one_or_none():
                raise HTTPException(409, detail=f"iButton {updates['ibutton_id']} already in use")

    for k, v in updates.items():
        setattr(driver, k, v)
    driver.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(driver)

    # vehicle changed: remove ibutton from old tracker, add to new one
    if old_imei and old_imei != driver.device_imei:
        await _send_ibutton_command(client, db, current_user, old_imei, old_ibutton, CMD_REMOVE_IBUTTON)
    if driver.device_imei:
        await _send_ibutton_command(client, db, current_user, driver.device_imei, driver.ibutton_id, CMD_ADD_IBUTTON)

    resp = DriverRegistryResponse.model_validate(driver)
    dev = await db.execute(select(DeviceCache).where(DeviceCache.imei == driver.device_imei))
    d = dev.scalar_one_or_none()
    resp.device_name = d.device_name if d else None
    return resp


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Delete a driver. If assigned to a vehicle, removes the iButton (145) from
    the tracker first."""
    result = await db.execute(select(DriverRegistry).where(DriverRegistry.id == driver_id))
    driver = result.scalar_one_or_none()
    if not driver:
        raise HTTPException(404, detail=f"Driver {driver_id} not found")

    if driver.device_imei:
        await _send_ibutton_command(client, db, current_user, driver.device_imei, driver.ibutton_id, CMD_REMOVE_IBUTTON)

    await db.delete(driver)
    await db.flush()
    return None