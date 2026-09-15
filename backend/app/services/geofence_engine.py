"""Geofence engine: evaluate device positions against active geofences.

Called from the track endpoint on every poll. Keeps per-(device, fence)
state in memory to detect transitions (outside→inside = entry, inside→
outside = exit) and emits events + alerts.
"""
import logging
import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, DeviceCache, Geofence, GeofenceEvent

logger = logging.getLogger(__name__)

# (imei, geofence_id) -> inside (bool)
_state: dict[tuple[str, int], bool] = {}


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters between two lat/lon points."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _point_in_polygon(lat: float, lon: float, poly: list[list[float]]) -> bool:
    """Ray casting. poly = [[lat, lon], ...] (closed implicitly)."""
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        yi, xi = poly[i][0], poly[i][1]
        yj, xj = poly[j][0], poly[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def is_inside(fence: Geofence, lat: float, lon: float) -> bool:
    if fence.shape == "circle":
        if fence.center_lat is None or fence.center_lon is None or fence.radius_m is None:
            return False
        return _haversine_m(lat, lon, fence.center_lat, fence.center_lon) <= fence.radius_m
    else:
        if not fence.polygon or len(fence.polygon) < 3:
            return False
        return _point_in_polygon(lat, lon, fence.polygon)


async def evaluate_positions(
    db: AsyncSession,
    positions: list[tuple[str, float, float, float | None]],
) -> list[GeofenceEvent]:
    """Evaluate each (imei, lat, lon, speed) against active fences.

    Returns the list of new GeofenceEvent rows (already added to the session,
    not committed — the caller owns the transaction).
    """
    result = await db.execute(select(Geofence).where(Geofence.is_active == True))  # noqa: E712
    fences = result.scalars().all()
    if not fences or not positions:
        return []

    # device names for alert messages (best effort)
    imeis = {p[0] for p in positions}
    dev_rows = await db.execute(
        select(DeviceCache).where(DeviceCache.imei.in_(imeis))
    )
    names = {d.imei: (d.device_name or d.imei) for d in dev_rows.scalars().all()}

    events: list[GeofenceEvent] = []

    for imei, lat, lon, speed in positions:
        for fence in fences:
            inside = is_inside(fence, lat, lon)
            key = (imei, fence.id)
            prev = _state.get(key)
            _state[key] = inside

            if prev is None:
                continue  # first sighting: baseline, no event

            if prev == inside:
                continue  # no transition

            event_type = "entry" if inside else "exit"
            if fence.alert_on != "both" and fence.alert_on != event_type:
                continue  # fence not configured to alert on this transition

            ev = GeofenceEvent(
                device_imei=imei,
                geofence_id=fence.id,
                event_type=event_type,
                lat=lat,
                lon=lon,
                speed=speed,
                created_at=datetime.now(timezone.utc),
            )
            db.add(ev)
            events.append(ev)

            # also create a fleet alert so it shows in the Alerts section
            dev_name = names.get(imei, imei)
            msg = (
                f"El vehículo \"{dev_name}\" entró a la geocerca \"{fence.name}\""
                if inside
                else f"El vehículo \"{dev_name}\" salió de la geocerca \"{fence.name}\""
            )
            db.add(
                Alert(
                    device_imei=imei,
                    alert_type=f"geofence_{event_type}",
                    message=f"{msg} ({datetime.now(timezone.utc).strftime('%H:%M UTC')})",
                    severity="warning" if event_type == "exit" else "info",
                )
            )

    if events:
        logger.info("Geofence engine: %d transition(s) detected", len(events))
    return events


def forget_device(imei: str) -> None:
    """Drop cached state for a device (e.g. after deleting a fence or vehicle)."""
    for key in [k for k in _state if k[0] == imei]:
        del _state[key]


def forget_all() -> None:
    """Drop all cached state (e.g. after fence edits)."""
    _state.clear()