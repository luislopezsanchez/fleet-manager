"""Automatic alerts engine: inactivity detection, overspeed, and batch runner."""
import logging
from datetime import datetime, timezone
from typing import List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.istarmap_client import IstarmapClient
from app.models import Alert, DeviceCache, GpsCache

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────
INACTIVITY_THRESHOLD_DAYS = 7

# istarmap warn IDs → alert type mapping
WARN_ID_MAP: dict[int, str] = {
    1022: "overspeed",
    1025: "geofence",
    1026: "geofence",
    1033: "offline",
    1018: "offline",
    1099: "offline",
    1038: "inactivity",   # idling
    1043: "fatigue",
}

# Which warn IDs are considered "overspeed" for the overspeed check
OVERSPEED_WARN_IDS: list[int] = [1022]


# ── Helpers ────────────────────────────────────────────────────────────────
def _parse_istarmap_time(raw: str | None) -> datetime | None:
    """Parse an istarmap timestamp string into a timezone-aware datetime.

    Istarmap returns timestamps in several possible formats:
      - ``yyyy-MM-ddTHH:mm:ss``  (no timezone)
      - ``yyyy-MM-ddTHH:mm:ssZ``
      - ``yyyy-MM-dd HH:mm:ss``
      - ``yyyy-MM-dd``
    Returns None if the value is empty or unparseable.
    """
    if not raw or not isinstance(raw, str):
        return None

    raw = raw.strip()
    # Replace space separator with T for ISO compatibility
    if " " in raw and "T" not in raw:
        raw = raw.replace(" ", "T")

    # Try a few common formats
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    # Last resort: ISO format
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        logger.warning("Could not parse istarmap timestamp: %s", raw)
        return None


def _days_since(dt: datetime | None) -> float | None:
    """Return the number of days between *dt* and now (UTC), or None."""
    if dt is None:
        return None
    delta = datetime.now(timezone.utc) - dt
    return delta.total_seconds() / 86400.0


async def _has_unacknowledged_alert(
    db: AsyncSession, imei: str, alert_type: str
) -> bool:
    """Check if an unacknowledged alert of the given type already exists for the device."""
    result = await db.execute(
        select(Alert.id)
        .where(
            and_(
                Alert.device_imei == imei,
                Alert.alert_type == alert_type,
                Alert.acknowledged_at.is_(None),
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


# ── Inactivity check ───────────────────────────────────────────────────────
async def check_inactivity(
    db: AsyncSession,
    istarmap_client: IstarmapClient,
    org_id: int,
) -> List[Alert]:
    """Check all devices for inactivity (no activity for >= 7 days).

    For each device we look at ``lastOnlineTime`` and ``activeTime`` from the
    istarmap API.  If the most recent of the two is older than
    ``INACTIVITY_THRESHOLD_DAYS`` we create a ``high`` severity alert — unless
    an unacknowledged inactivity alert already exists for that device.

    Returns the list of newly created alerts.
    """
    created: list[Alert] = []

    try:
        devices = await istarmap_client.get_devices(org_id)
    except Exception as exc:
        logger.error("check_inactivity: failed to get devices from istarmap: %s", exc)
        return created

    for dev in devices:
        imei = dev.get("imei") or dev.get("sn") or dev.get("deviceImei")
        if not imei:
            continue

        device_name = dev.get("deviceName") or dev.get("name") or imei

        # Try lastOnlineTime first, then activeTime
        last_online_raw = dev.get("lastOnlineTime") or dev.get("lastTime")
        active_raw = dev.get("activeTime")

        last_online = _parse_istarmap_time(last_online_raw)
        active = _parse_istarmap_time(active_raw)

        # Use the most recent of the two timestamps
        most_recent = None
        if last_online and active:
            most_recent = max(last_online, active)
        elif last_online:
            most_recent = last_online
        elif active:
            most_recent = active

        if most_recent is None:
            # No timestamp data at all — can't determine inactivity
            continue

        # istarmap uses 2000-01-01T00:00:00Z as a sentinel for "never
        # connected". Treat it (and anything older than 2001) as "never
        # connected" rather than "inactive for decades".
        if most_recent.year < 2001:
            continue

        days = _days_since(most_recent)
        if days is None or days < INACTIVITY_THRESHOLD_DAYS:
            continue

        # Skip if there's already an unacknowledged inactivity alert for this device
        if await _has_unacknowledged_alert(db, imei, "inactivity"):
            continue

        alert = Alert(
            device_imei=imei,
            alert_type="inactivity",
            severity="high",
            message=(
                f"El vehículo \"{device_name}\" (IMEI {imei}) no ha registrado "
                f"actividad en los últimos {int(days)} días. "
                f"Última actividad: {most_recent.strftime('%Y-%m-%d %H:%M')} UTC."
            ),
        )
        db.add(alert)
        await db.flush()
        await db.refresh(alert)
        created.append(alert)
        logger.info(
            "Inactivity alert created for %s (%s) — %d days inactive",
            device_name, imei, int(days),
        )

    if created:
        await db.flush()
    logger.info("check_inactivity: %d new alerts created", len(created))
    return created


# ── Overspeed check ────────────────────────────────────────────────────────
async def check_overspeed_alerts(
    db: AsyncSession,
    istarmap_client: IstarmapClient,
    org_id: int,
) -> List[Alert]:
    """Check recent GPS positions for overspeed warnings (warnId 1022).

    Examines the ``warn_ids`` column of recent ``GpsCache`` entries.  If a
    position contains an overspeed warning and no unacknowledged overspeed
    alert exists for that device, a new ``medium`` severity alert is created.

    Returns the list of newly created alerts.
    """
    created: list[Alert] = []

    # Get recent GPS positions that have warn_ids
    result = await db.execute(
        select(GpsCache)
        .where(GpsCache.warn_ids.isnot(None))
        .order_by(GpsCache.id.desc())
        .limit(500)
    )
    positions = result.scalars().all()

    seen_imeis: set[str] = set()

    for pos in positions:
        if not pos.warn_ids:
            continue

        warn_ids: list[int] = []
        if isinstance(pos.warn_ids, list):
            warn_ids = [int(w) for w in pos.warn_ids if w is not None]
        elif isinstance(pos.warn_ids, (int, str)):
            try:
                warn_ids = [int(pos.warn_ids)]
            except (ValueError, TypeError):
                pass

        # Check for overspeed (1022)
        has_overspeed = any(w in OVERSPEED_WARN_IDS for w in warn_ids)
        if not has_overspeed:
            continue

        # Deduplicate per device within this batch
        if pos.device_imei in seen_imeis:
            continue

        # Skip if unacknowledged overspeed alert already exists
        if await _has_unacknowledged_alert(db, pos.device_imei, "overspeed"):
            continue

        seen_imeis.add(pos.device_imei)

        speed_str = f"{pos.speed:.1f} km/h" if pos.speed is not None else "N/A"
        gps_time_str = pos.gps_time or "unknown"

        alert = Alert(
            device_imei=pos.device_imei,
            alert_type="overspeed",
            severity="medium",
            message=(
                f"Exceso de velocidad detectado para IMEI {pos.device_imei}. "
                f"Velocidad: {speed_str}. Hora GPS: {gps_time_str}. "
                f"WarnIds: {warn_ids}."
            ),
        )
        db.add(alert)
        await db.flush()
        await db.refresh(alert)
        created.append(alert)
        logger.info(
            "Overspeed alert created for %s — speed %s, warnIds %s",
            pos.device_imei, speed_str, warn_ids,
        )

    if created:
        await db.flush()
    logger.info("check_overspeed_alerts: %d new alerts created", len(created))
    return created


# ── Batch runner ───────────────────────────────────────────────────────────
async def run_all_alerts(
    db: AsyncSession,
    istarmap_client: IstarmapClient,
    org_id: int,
) -> List[Alert]:
    """Run all alert checks and return the combined list of newly created alerts."""
    all_created: list[Alert] = []

    logger.info("run_all_alerts: starting for org_id=%s", org_id)

    try:
        inactivity_alerts = await check_inactivity(db, istarmap_client, org_id)
        all_created.extend(inactivity_alerts)
    except Exception as exc:
        logger.error("run_all_alerts: inactivity check failed: %s", exc)

    try:
        overspeed_alerts = await check_overspeed_alerts(db, istarmap_client, org_id)
        all_created.extend(overspeed_alerts)
    except Exception as exc:
        logger.error("run_all_alerts: overspeed check failed: %s", exc)

    logger.info("run_all_alerts: finished — %d total new alerts", len(all_created))
    return all_created