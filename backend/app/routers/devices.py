"""Devices router: list, sync, position, live tracking."""
import logging
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import DeviceCache, GpsCache, User, UserRole
from app.services.geofence_engine import evaluate_positions
from app.schemas import (
    CommandResultResponse,
    DeviceListResponse,
    DeviceResponse,
    DeviceSectorAssignRequest,
    DeviceSyncResponse,
    GpsPosition,
    HistoryRequest,
    HistoryResponse,
    TermCtrlRequest,
    TermCtrlResponse,
    TrackRequest,
    TrackResponse,
    VehicleCreateRequest,
    VehicleUpdateRequest,
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

        # locally-deleted vehicles stay deleted: skip, never revive from cloud
        if record is not None and record.is_excluded:
            continue

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
    query = select(DeviceCache).where(DeviceCache.is_excluded == False).order_by(DeviceCache.device_name)

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


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    body: VehicleCreateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Register a vehicle (GPS tracker) locally. Admin only.

    The device must already exist in Istarmap (identified by IMEI); this creates
    the local cache entry so it appears in the fleet lists.
    """
    existing = await db.execute(select(DeviceCache).where(DeviceCache.imei == body.imei))
    record = existing.scalar_one_or_none()
    if record is not None and not record.is_excluded:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vehicle with IMEI {body.imei} already exists",
        )

    if record is not None:
        # previously deleted locally — revive it with the new data
        record.is_excluded = False
        record.device_name = body.device_name
        record.driver_name = body.driver_name
        record.plate_no = body.plate_no
        record.org_id = body.org_id
        record.sector_id = body.sector_id
        record.over_speed = body.over_speed
        record.sim = body.sim
        record.car_vin = body.car_vin
        record.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(record)
        return DeviceResponse.model_validate(record)

    record = DeviceCache(
        imei=body.imei,
        device_name=body.device_name,
        driver_name=body.driver_name,
        plate_no=body.plate_no,
        org_id=body.org_id,
        sector_id=body.sector_id,
        over_speed=body.over_speed,
        sim=body.sim,
        car_vin=body.car_vin,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return DeviceResponse.model_validate(record)


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


@router.put("/{imei}", response_model=DeviceResponse)
async def update_vehicle(
    imei: str,
    body: VehicleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Edit a vehicle's local fields. Admin only."""
    result = await db.execute(select(DeviceCache).where(DeviceCache.imei == imei))
    device = result.scalar_one_or_none()
    if not device or device.is_excluded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle with IMEI {imei} not found",
        )

    updates = body.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(device, k, v)
    device.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(device)
    return DeviceResponse.model_validate(device)


@router.delete("/{imei}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    imei: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Remove a vehicle from the local fleet. Admin only.

    Istarmap's API has no device-delete endpoint, so the device remains in the
    cloud: we tombstone it locally (is_excluded) so lists hide it and the hourly
    sync does not revive it. It can be re-added later by IMEI.
    """
    result = await db.execute(select(DeviceCache).where(DeviceCache.imei == imei))
    device = result.scalar_one_or_none()
    if not device or device.is_excluded:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle with IMEI {imei} not found",
        )
    device.is_excluded = True
    device.updated_at = datetime.now(timezone.utc)
    await db.flush()
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

    # evaluate geofence transitions for every fresh position (entry/exit
    # detection creates events + alerts; session committed by FastAPI)
    try:
        await evaluate_positions(
            db,
            [(p.device_imei, p.lat, p.lon, p.speed) for p in positions],
        )
    except Exception as exc:
        logger.error("Geofence evaluation failed: %s", exc)

    return TrackResponse(
        total=len(positions),
        positions=positions,
        last_query_time=new_lqt,
    )


# ── Playback / History ─────────────────────────────────────────────────────
@router.post("/{imei}/history", response_model=HistoryResponse)
async def get_device_history(
    imei: str,
    body: HistoryRequest,
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Historical GPS track for playback (GET /tapi/tracker/history/{imei})."""
    if body.imei != imei:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imei in path and body must match",
        )

    # istarmap requires exactly yyyy-MM-ddTHH:mm:ssZ; tolerate missing seconds
    # or extra milliseconds from clients instead of failing after 3 retries.
    def _norm_ts(ts: str) -> str:
        m = re.match(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$", ts)
        if not m:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid timestamp '{ts}' — expected yyyy-MM-ddTHH:mm:ssZ",
            )
        return f"{m.group(1)}:{m.group(2) or '00'}Z"

    start_ts = _norm_ts(body.start_time)
    end_ts = _norm_ts(body.end_time)

    try:
        raw = await client.get_history(
            imei, start_ts, end_ts, body.filter_drift
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap history failed: {exc}",
        )

    points = []
    for p in raw:
        lat = float(p.get("lat", 0) or 0)
        lon = float(p.get("lon", 0) or 0)
        if lat == 0.0 and lon == 0.0:
            continue
        raw_speed = p.get("speed")
        speed_kmh = round(float(raw_speed) / 1000.0, 1) if raw_speed is not None else None
        odo_raw = p.get("odometer")
        odo_km = round(float(odo_raw) / 1000.0, 2) if odo_raw is not None else None
        points.append(
            {
                "lat": lat,
                "lon": lon,
                "speed": speed_kmh,
                "gps_time": p.get("gpsTime"),
                "angle": float(p["angle"]) if p.get("angle") is not None else None,
                "status1": p.get("status1"),
                "mask1": p.get("mask1"),
                "odometer": odo_km,
                "satellites": p.get("quantity"),
                "ext_voltage": p.get("extVoltage"),
            }
        )

    return HistoryResponse(total=len(points), points=points)


# ── Terminal control (commands) ────────────────────────────────────────────
@router.post("/{imei}/command", response_model=TermCtrlResponse)
async def send_term_ctrl(
    imei: str,
    body: TermCtrlRequest,
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Send a terminal control command to a vehicle. Admin only.

    ctrl_type: OIL_ELE_CUT (cut fuel/electricity) | OIL_ELE_RECOVER (restore).
    """
    if body.imei != imei:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="imei in path and body must match",
        )
    try:
        result = await client.term_ctrl(imei, body.ctrl_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap termCtrl failed: {exc}",
        )

    data = result.get("data", {}) if isinstance(result, dict) else {}
    return TermCtrlResponse(
        request_id=data.get("requestId"),
        result=data.get("result"),
        message=result.get("msg") if isinstance(result, dict) else None,
    )


@router.get("/{imei}/command_result", response_model=CommandResultResponse)
async def get_term_ctrl_result(
    imei: str,
    request_id: str,
    current_user: User = Depends(role_required("admin")),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Query the delivery result of a terminal command by requestId. Admin only."""
    try:
        result = await client.get_command_result(imei, request_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap command result failed: {exc}",
        )
    data = result.get("data", {}) if isinstance(result, dict) else {}
    return CommandResultResponse(
        request_id=request_id,
        result=data.get("result") if isinstance(data, dict) else None,
        raw=result,
    )
