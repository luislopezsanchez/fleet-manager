"""Alerts router: list (with filters), acknowledge, manual check, and stats."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.istarmap_client import get_authenticated_istarmap_client, IstarmapClient
from app.models import Alert, User
from app.schemas import AlertListResponse, AlertResponse, AlertStatsResponse
from app.services.alerts_engine import run_all_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=AlertListResponse)
async def list_alerts(
    severity: str | None = None,
    type: str | None = None,
    acknowledged: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List alerts with optional filters: severity, type, acknowledged."""
    query = select(Alert)

    # ── Filters ──
    if severity is not None:
        query = query.where(Alert.severity == severity)

    if type is not None:
        query = query.where(Alert.alert_type == type)

    if acknowledged is not None:
        if acknowledged:
            query = query.where(Alert.acknowledged_at.isnot(None))
        else:
            query = query.where(Alert.acknowledged_at.is_(None))

    # ── Count total matching (before pagination) ──
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # ── Paginated results ──
    query = query.order_by(desc(Alert.created_at)).limit(limit).offset(offset)
    result = await db.execute(query)
    alerts = result.scalars().all()

    return AlertListResponse(
        total=total,
        alerts=[AlertResponse.model_validate(a) for a in alerts],
    )


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert {alert_id} not found",
        )

    if alert.acknowledged_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Alert already acknowledged",
        )

    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.post("/check", response_model=AlertListResponse)
async def manual_check(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    client: IstarmapClient = Depends(get_authenticated_istarmap_client),
):
    """Manually trigger alert checks (inactivity + overspeed) and return newly created alerts."""
    org_id = settings.ISTARMAP_ORG_ID
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ISTARMAP_ORG_ID is not configured",
        )

    try:
        created = await run_all_alerts(db, client, org_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Alert check failed: {exc}",
        )

    return AlertListResponse(
        total=len(created),
        alerts=[AlertResponse.model_validate(a) for a in created],
    )


@router.get("/stats", response_model=AlertStatsResponse)
async def alert_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregate alert statistics."""
    # Total count
    total_result = await db.execute(select(func.count()).select_from(Alert))
    total = total_result.scalar() or 0

    # Unacknowledged count
    unack_result = await db.execute(
        select(func.count()).select_from(Alert).where(Alert.acknowledged_at.is_(None))
    )
    unacknowledged = unack_result.scalar() or 0

    # By severity
    by_severity_result = await db.execute(
        select(Alert.severity, func.count()).group_by(Alert.severity)
    )
    by_severity = {"high": 0, "medium": 0, "low": 0, "critical": 0, "info": 0}
    for sev, count in by_severity_result.all():
        if sev and sev in by_severity:
            by_severity[sev] = count

    # By type
    by_type_result = await db.execute(
        select(Alert.alert_type, func.count()).group_by(Alert.alert_type)
    )
    by_type: dict[str, int] = {}
    for atype, count in by_type_result.all():
        if atype:
            by_type[atype] = count

    return AlertStatsResponse(
        total=total,
        by_severity=by_severity,
        by_type=by_type,
        unacknowledged=unacknowledged,
    )