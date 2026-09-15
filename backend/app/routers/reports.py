"""Reports router: proxy to istarmap report endpoints + local reports."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.istarmap_client import IstarmapClient, get_authenticated_istarmap_client
from app.models import DeviceCache, DriverAssignment, Geofence, GeofenceEvent, User

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


def _parse_ts(value: str) -> "object":
    """Validate yyyy-MM-ddTHH:mm:ssZ timestamps (istarmap format)."""
    import re
    m = re.match(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$", value)
    if not m:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid timestamp '{value}' — expected yyyy-MM-ddTHH:mm:ssZ",
        )
    from datetime import datetime, timezone
    return datetime(
        int(value[0:4]), int(value[5:7]), int(value[8:10]),
        int(value[11:13]), int(value[14:16]), int(m.group(2) or 0),
        tzinfo=timezone.utc,
    )


@router.get("/working")
async def report_working(
    org_id: int = Query(..., description="Organization ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Operations overview — proxy to istarmap /tapi/report/working."""
    try:
        result = await client.get_report_working(org_id, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )
    return result


@router.get("/mileage")
async def report_mileage(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Mileage per vehicle (derived from working report, filtered by vid)."""
    try:
        from app.config import settings
        result = await client.get_report_working(settings.ISTARMAP_ORG_ID, start_time, end_time)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )
    data = result.get("data") if isinstance(result, dict) else None
    if data is None:
        return {"code": 1, "msg": "Query in progress, try again later", "data": None}
    infos = data.get("workingDeviceInfos", []) if isinstance(data, dict) else []
    matching = [d for d in infos if d.get("vid") == vid]
    return {"code": 0, "msg": "", "data": matching, "total": len(matching)}


@router.get("/alarms")
async def report_alarms(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    warn_ids: str = Query("", description="Comma-separated warn IDs, e.g. 1025,1026"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Alarm/warning detail — proxy to istarmap /tapi/report/warn_detail."""
    parsed_warn_ids = None
    if warn_ids:
        try:
            parsed_warn_ids = [int(x.strip()) for x in warn_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(400, detail="warn_ids must be comma-separated integers")
    try:
        result = await client.get_report_warn_detail(vid, start_time, end_time, parsed_warn_ids)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Istarmap report failed: {exc}",
        )
    return result


@router.get("/overspeed")
async def report_overspeed(
    vid: int = Query(..., description="Vehicle ID"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Speeding incidents (derived from working report)."""
    from app.config import settings
    try:
        result = await client.get_report_working(settings.ISTARMAP_ORG_ID, start_time, end_time)
    except Exception as exc:
        raise HTTPException(502, detail=f"Istarmap report failed: {exc}")
    data = result.get("data") if isinstance(result, dict) else None
    if data is None:
        return {"code": 1, "msg": "Query in progress, try again later", "data": None}
    infos = data.get("workingDeviceInfos", []) if isinstance(data, dict) else []
    matching = [d for d in infos if d.get("vid") == vid]
    return {"code": 0, "msg": "", "data": matching, "total": len(matching)}


@router.get("/history")
async def report_history(
    imei: str = Query(..., description="Device IMEI"),
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Historical GPS track — proxy to istarmap /tapi/tracker/history/{imei}."""
    try:
        result = await client.get_history(imei, start_time, end_time)
    except Exception as exc:
        raise HTTPException(502, detail=f"Istarmap history failed: {exc}")
    return result


# ── Local reports ───────────────────────────────────────────────────────────

@router.get("/geofences")
async def report_geofences(
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    device_imei: str | None = Query(None, description="Filter by vehicle IMEI"),
    geofence_id: int | None = Query(None, description="Filter by geofence ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Geofence report: entry/exit events in a period, with vehicle and fence names."""
    start = _parse_ts(start_time)
    end = _parse_ts(end_time)

    query = (
        select(GeofenceEvent, Geofence.name, DeviceCache.device_name)
        .outerjoin(Geofence, GeofenceEvent.geofence_id == Geofence.id)
        .outerjoin(DeviceCache, GeofenceEvent.device_imei == DeviceCache.imei)
        .where(GeofenceEvent.created_at >= start, GeofenceEvent.created_at <= end)
        .order_by(desc(GeofenceEvent.created_at))
        .limit(2000)
    )
    if device_imei:
        query = query.where(GeofenceEvent.device_imei == device_imei)
    if geofence_id:
        query = query.where(GeofenceEvent.geofence_id == geofence_id)

    result = await db.execute(query)
    rows = []
    for ev, fence_name, dev_name in result.all():
        rows.append({
            "fecha": ev.created_at.isoformat(),
            "vehiculo": dev_name or ev.device_imei,
            "imei": ev.device_imei,
            "geocerca": fence_name or f"#{ev.geofence_id}",
            "evento": "entrada" if ev.event_type == "entry" else "salida",
            "velocidad_kmh": ev.speed,
            "lat": ev.lat,
            "lon": ev.lon,
        })
    return {"total": len(rows), "data": rows}


@router.get("/drivers")
async def report_drivers(
    start_time: str = Query(..., description="Start time yyyy-MM-ddTHH:mm:ssZ"),
    end_time: str = Query(..., description="End time yyyy-MM-ddTHH:mm:ssZ"),
    device_imei: str = Query(..., description="Vehicle IMEI"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Driver report: who drove vehicle X during the period.

    Matches driver assignments overlapping the requested range, and pairs
    them with the geofence events of the vehicle in the same period, so you
    can see who was driving and where the vehicle went.
    """
    start = _parse_ts(start_time)
    end = _parse_ts(end_time)

    # overlapping assignments: assignment overlaps if
    # (start_time <= end) and (end_time is null or end_time >= start)
    from sqlalchemy import and_, or_
    q = select(DriverAssignment).where(
        and_(
            DriverAssignment.device_imei == device_imei,
            DriverAssignment.start_time <= end,
            or_(
                DriverAssignment.end_time == None,  # noqa: E711
                DriverAssignment.end_time >= start,
            ),
        )
    ).order_by(DriverAssignment.start_time)
    res = await db.execute(q)
    assignments = res.scalars().all()

    dev_res = await db.execute(select(DeviceCache).where(DeviceCache.imei == device_imei))
    dev = dev_res.scalar_one_or_none()
    vehicle_name = dev.device_name if dev else device_imei

    # geofence events for the same vehicle/period (context: where it went)
    evq = (
        select(GeofenceEvent, Geofence.name)
        .outerjoin(Geofence, GeofenceEvent.geofence_id == Geofence.id)
        .where(
            GeofenceEvent.device_imei == device_imei,
            GeofenceEvent.created_at >= start,
            GeofenceEvent.created_at <= end,
        )
        .order_by(GeofenceEvent.created_at)
    )
    ev_res = await db.execute(evq)
    events = [
        {
            "fecha": ev.created_at.isoformat(),
            "geocerca": fname or f"#{ev.geofence_id}",
            "evento": "entrada" if ev.event_type == "entry" else "salida",
        }
        for ev, fname in ev_res.all()
    ]

    rows = []
    for a in assignments:
        overlap_start = max(a.start_time, start)
        overlap_end = min(a.end_time, end) if a.end_time else end
        rows.append({
            "vehiculo": vehicle_name,
            "imei": a.device_imei,
            "conductor": a.driver_name,
            "documento": a.driver_doc,
            "desde": a.start_time.isoformat(),
            "hasta": a.end_time.isoformat() if a.end_time else "actualidad",
            "periodo_solapado_inicio": overlap_start.isoformat(),
            "periodo_solapado_fin": overlap_end.isoformat(),
            "notas": a.notes,
        })

    return {
        "total": len(rows),
        "data": rows,
        "eventos_geocerca": events,
    }
