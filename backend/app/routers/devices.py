"""Devices router: list, sync, position, live tracking."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import DeviceCache, GpsCache, User, UserRole
from app.schemas import (
    DeviceListResponse,
    DeviceResponse,
    DeviceSectorAssignRequest,
    DeviceSyncResponse,
    GpsPosition,
    TrackRequest,
    TrackResponse,
)

router = APIRouter(prefix="/devices", tags=["devices"])
logger = logging.getLogger(__name__)


def _status_bit(mask1: int | None, status1: int | None, bit: int) -> bool | None:
    """Decode a status bit: value is valid only if the mask bit is set (see API doc).

    ACC is bit 0 of status1, validated by bit 0 of mask1.
    """
    if mask1 is None or status1 is None:
        return None
    if not (mask1 & (1 << bit)):
        return None  # bit not reported by device
    return bool(status1 & (1 << bit))


async def sync_devices_into_db(
    db: AsyncSession, client: IstarmapClient, org_id: int
) -> int:
    """Fetch all devices from Istarmap and upsert into DeviceCache. Returns synced count."""
    remote_devices = await client.get_devices(org_id)
    synced = 0
    for dev in remote_devices:
        imei = dev.get("imei") or dev.get("sn") or dev.get("deviceImei")
        if not imei:
            continue

        existing = await db.execute(select(DeviceCache).where(DeviceCache.imei == imei))
        record = existing.scalar_one_or_none()

        fields = {
            "id": dev.get("id", 0),
            "device_name": dev.get("deviceName") or dev.get("name"),
            "driver_name": dev.get("driverName") or dev.get("driver"),
            "plate_no": dev.get("plateNo") or dev.get("plate"),
            "org_id": dev.get("orgId") or org_id,
            "last_online_time": dev.get("lastOnlineTime") or dev.get("lastTime"),
            "active_time": dev.get("activeTime"),
            "avatar": dev.get("avatar"),
            "icon_name": dev.get("iconName") or dev.get("icon"),
            "over_speed": dev.get("overSpeed"),
            "fuel_value": dev.get("fuelValue"),
            "sim": dev.get("sim") or dev.get("simNo"),
            "iccid": dev.get("iccid"),
            "car_vin": dev.get("carVin") or dev.get("vin"),
            "raw_json": dev,
            "updated_at": datetime.now(timezone.utc),
        }

        if record:
            for k, v in fields.items():
                setattr(record, k, v)
        else:
            record = DeviceCache(imei=imei, **fields)
            db.add(record)
        synced += 1

    await db.flush()
    return synced


@router.get("/", response_model=DeviceListResponse)
async def list_devices(
    sector_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List devices from local cache. Admins see all (optionally filtered by sector_id);
    supervisors see only their sector's devices."""
    query = select(DeviceCache).order_by(DeviceCache.device_name)

    # If supervisor, restrict to their sector
    if current_user.role == UserRole.supervisor and current_user.sector_id is not None:
        query = query.where(DeviceCache.sector_id == current_user.sector_id)
    elif current_user.role == UserRole.supervisor:
        # Supervisor with no sector sees no devices
        query = query.where(DeviceCache.sector_id == -1)

    # Optional sector_id filter (admins use this to filter; supervisors already filtered)
    if sector_id is not None:
        query = query.where(DeviceCache.sector_id == sector_id)

    result = await db.execute(query)
    devices = result.scalars().all()
    return DeviceListResponse(
        total=len(devices),
        devices=[DeviceResponse.model_validate(d) for d in devices],
    )


@router.post("/sync", response_model=DeviceSyncResponse)
async def sync_devices(
    org_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Force a sync with Istarmap: fetch all devices and upsert into DeviceCache."""
    try:
        synced = await sync_devices_into_db(db, client, org_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap sync failed: {exc}",
        )

    return DeviceSyncResponse(
        synced=synced,
        total=synced,
        message=f"Synced {synced} devices from Istarmap",
    )


@router.get("/{imei}/position", response_model=GpsPosition)
async def get_device_position(
    imei: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest cached GPS position for a device."""
    result = await db.execute(
        select(GpsCache)
        .where(GpsCache.device_imei == imei)
        .order_by(desc(GpsCache.id))
        .limit(1)
    )
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No cached GPS position for IMEI {imei}",
        )
    return GpsPosition.model_validate(pos)


@router.put("/{imei}/sector", response_model=DeviceResponse)
async def assign_device_sector(
    imei: str,
    body: DeviceSectorAssignRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Assign or unassign a device to a sector. Admin only."""
    result = await db.execute(select(DeviceCache).where(DeviceCache.imei == imei))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device with IMEI {imei} not found",
        )

    device.sector_id = body.sector_id
    await db.flush()
    await db.refresh(device)
    return DeviceResponse.model_validate(device)


def _first_id_value(items: list | None) -> float | None:
    """Extract the first value from an IdValueDto list ([{"id": .., "value": v}])."""
    if not items:
        return None
    for it in items:
        if isinstance(it, dict) and it.get("value") is not None:
            return float(it["value"])
    return None


@router.post("/track", response_model=TrackResponse)
async def track_devices(
    body: TrackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Live tracking: call /tapi/tracker and store positions in GpsCache."""
    try:
        result = await client.track_devices(body.org_id, body.last_query_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap tracking failed: {exc}",
        )

    raw_positions = []
    if isinstance(result, dict):
        data = result.get("data", {})
        if isinstance(data, dict):
            raw_positions = data.get("gpsInfos", [])
        elif isinstance(data, list):
            raw_positions = data
        new_lqt = data.get("lastQueryTime") if isinstance(data, dict) else result.get("lastQueryTime")
    elif isinstance(result, list):
        raw_positions = result

    positions: list[GpsPosition] = []
    for p in raw_positions:
        imei = p.get("imei") or p.get("sn") or p.get("deviceImei")
        if not imei:
            continue

        lat = float(p.get("lat", p.get("latitude", 0)) or 0)
        lon = float(p.get("lon", p.get("longitude", 0)) or 0)
        # Skip invalid coordinates (0,0 = GPS sin señal / "null island")
        if lat == 0.0 and lon == 0.0:
            continue

        raw_speed = float(p.get("speed", 0)) if p.get("speed") is not None else None
        # istarmap returns speed in meters/hour — convert to km/h
        speed_kmh = round(raw_speed / 1000.0, 1) if raw_speed is not None else None

        # ACC: bit 0 of status1, valid only when bit 0 of mask1 is set (per API doc)
        mask1 = p.get("mask1")
        status1 = p.get("status1")
        if mask1 is not None:
            mask1 = int(mask1)
        if status1 is not None:
            status1 = int(status1)
        acc_on = _status_bit(mask1, status1, 0)
        if acc_on is None and p.get("accOn") is not None:
            acc_on = bool(p.get("accOn"))

        # OBD data (ObdDataDto)
        obd = p.get("obdData") or {}
        if not isinstance(obd, dict):
            obd = {}

        # Fuel liters: IdValueDto list, value unit 0.1L
        fuel_liters_raw = _first_id_value(p.get("fuelLiters"))
        fuel_liters = round(fuel_liters_raw / 10.0, 1) if fuel_liters_raw is not None else None

        # Odometer: meters → km
        odo_raw = p.get("odometer")
        odometer_km = round(float(odo_raw) / 1000.0, 2) if odo_raw is not None else None

        gps = GpsCache(
            device_imei=imei,
            lat=lat,
            lon=lon,
            speed=speed_kmh,
            gps_time=p.get("gpsTime") or p.get("time"),
            odometer=odometer_km,
            status1=status1,
            mask1=mask1,
            acc_on=acc_on,
            warn_ids=p.get("warnIds") or p.get("warnIdsList"),
            angle=float(p["angle"]) if p.get("angle") is not None else None,
            altitude=round(float(p["altitude"]) / 10.0, 1) if p.get("altitude") is not None else None,
            satellites=p.get("quantity"),
            gsm_signal=p.get("csqQuantity"),
            ext_voltage=p.get("extVoltage"),
            bat_voltage=p.get("batVoltage"),
            fuel_liters=fuel_liters,
            validity=p.get("validity"),
            device_name=p.get("deviceName"),
            last_online_time=p.get("lastOnlineTime"),
            engine_rpm=obd.get("rpm"),
            coolant_temp=obd.get("coolantTemp"),
            engine_load=obd.get("engineLoad"),
            fuel_level=obd.get("fuelLevel"),
            instant_fuel=obd.get("instantFuel"),
            obd_speed=obd.get("speed"),
            raw_json=p,
        )
        db.add(gps)
        await db.flush()
        await db.refresh(gps)
        positions.append(GpsPosition.model_validate(gps))

    return TrackResponse(
        total=len(positions),
        positions=positions,
        last_query_time=new_lqt,
    )