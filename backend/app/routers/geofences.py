"""Geofences router: CRUD + drawing + events history."""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.models import DeviceCache, Geofence, GeofenceEvent, User
from app.schemas import (
    GeofenceCreate,
    GeofenceEventResponse,
    GeofenceResponse,
    GeofenceUpdate,
)
from app.services.geofence_engine import forget_all, forget_device

router = APIRouter(prefix="/geofences", tags=["geofences"])
logger = logging.getLogger(__name__)


def _validate_create(body: GeofenceCreate) -> None:
    if body.shape not in ("circle", "polygon"):
        raise HTTPException(400, detail="shape must be 'circle' or 'polygon'")
    if body.alert_on not in ("entry", "exit", "both"):
        raise HTTPException(400, detail="alert_on must be 'entry', 'exit' or 'both'")
    if body.shape == "circle":
        if body.center_lat is None or body.center_lon is None or body.radius_m is None:
            raise HTTPException(400, detail="circle geofence requires center_lat, center_lon and radius_m")
        if body.radius_m <= 0:
            raise HTTPException(400, detail="radius_m must be > 0")
        if body.radius_m > 200:
            raise HTTPException(400, detail="radius_m must be <= 200 m (current policy)")
    else:
        if not body.polygon or len(body.polygon) < 3:
            raise HTTPException(400, detail="polygon geofence requires at least 3 points")


@router.get("/", response_model=list[GeofenceResponse])
async def list_geofences(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Geofence).order_by(Geofence.name)
    if not include_inactive:
        query = query.where(Geofence.is_active == True)  # noqa: E712
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=GeofenceResponse, status_code=status.HTTP_201_CREATED)
async def create_geofence(
    body: GeofenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Draw/create a geofence. Admin only."""
    _validate_create(body)
    fence = Geofence(
        name=body.name,
        description=body.description,
        shape=body.shape,
        center_lat=body.center_lat,
        center_lon=body.center_lon,
        radius_m=body.radius_m,
        polygon=body.polygon,
        color=body.color,
        alert_on=body.alert_on,
        is_active=body.is_active,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(fence)
    await db.flush()
    await db.refresh(fence)
    forget_all()  # reset engine state so new fence takes effect cleanly
    return fence


@router.put("/{fence_id}", response_model=GeofenceResponse)
async def update_geofence(
    fence_id: int,
    body: GeofenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Update a geofence (name, color, alerts, active, radius). Admin only."""
    result = await db.execute(select(Geofence).where(Geofence.id == fence_id))
    fence = result.scalar_one_or_none()
    if not fence:
        raise HTTPException(404, detail=f"Geofence {fence_id} not found")
    if body.alert_on is not None and body.alert_on not in ("entry", "exit", "both"):
        raise HTTPException(400, detail="alert_on must be 'entry', 'exit' or 'both'")

    updates = body.model_dump(exclude_unset=True)

    # moving a circle: validate new center + radius stay coherent
    if body.radius_m is not None and (body.radius_m <= 0 or body.radius_m > 200):
        raise HTTPException(400, detail="radius_m must be between 1 and 200 m")

    for k, v in updates.items():
        setattr(fence, k, v)
    fence.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(fence)
    forget_all()
    return fence


@router.delete("/{fence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_geofence(
    fence_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Delete a geofence and its events. Admin only."""
    result = await db.execute(select(Geofence).where(Geofence.id == fence_id))
    fence = result.scalar_one_or_none()
    if not fence:
        raise HTTPException(404, detail=f"Geofence {fence_id} not found")
    # cascade events manually (FK ondelete handles it at DB level too)
    await db.execute(GeofenceEvent.__table__.delete().where(GeofenceEvent.geofence_id == fence_id))
    await db.delete(fence)
    await db.flush()
    forget_all()
    return None


@router.get("/events", response_model=list[GeofenceEventResponse])
async def list_events(
    limit: int = 100,
    device_imei: str | None = None,
    geofence_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Geofence transition history (entries/exits)."""
    limit = min(limit, 500)
    query = (
        select(GeofenceEvent, Geofence.name, DeviceCache.device_name)
        .outerjoin(Geofence, GeofenceEvent.geofence_id == Geofence.id)
        .outerjoin(DeviceCache, GeofenceEvent.device_imei == DeviceCache.imei)
        .order_by(desc(GeofenceEvent.id))
        .limit(limit)
    )
    if device_imei:
        query = query.where(GeofenceEvent.device_imei == device_imei)
    if geofence_id:
        query = query.where(GeofenceEvent.geofence_id == geofence_id)

    result = await db.execute(query)
    rows = []
    for ev, fence_name, dev_name in result.all():
        rows.append(
            GeofenceEventResponse(
                id=ev.id,
                device_imei=ev.device_imei,
                geofence_id=ev.geofence_id,
                event_type=ev.event_type,
                lat=ev.lat,
                lon=ev.lon,
                speed=ev.speed,
                created_at=ev.created_at,
                geofence_name=fence_name,
                device_name=dev_name,
            )
        )
    return rows