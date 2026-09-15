"""Driver assignments router: who drove which vehicle, when."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, role_required
from app.database import get_db
from app.models import DeviceCache, DriverAssignment, User
from app.schemas import (
    DriverAssignmentCreate,
    DriverAssignmentResponse,
)

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("/assignments", response_model=list[DriverAssignmentResponse])
async def list_assignments(
    device_imei: str | None = None,
    current: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List driver assignments, optionally filtered by vehicle or current only."""
    query = select(DriverAssignment).order_by(DriverAssignment.start_time.desc())
    if device_imei:
        query = query.where(DriverAssignment.device_imei == device_imei)
    if current:
        query = query.where(DriverAssignment.end_time == None)  # noqa: E711
    result = await db.execute(query.limit(500))
    return result.scalars().all()


@router.post("/assignments", response_model=DriverAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    body: DriverAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Register that a driver used a vehicle from start_time (until end_time, NULL=open). Admin only."""
    # vehicle must exist
    dev = await db.execute(select(DeviceCache).where(DeviceCache.imei == body.device_imei))
    if not dev.scalar_one_or_none():
        raise HTTPException(404, detail=f"Vehicle with IMEI {body.device_imei} not found")

    # close any open assignment for this vehicle (a vehicle has one driver at a time)
    open_rows = await db.execute(
        select(DriverAssignment).where(
            DriverAssignment.device_imei == body.device_imei,
            DriverAssignment.end_time == None,  # noqa: E711
        )
    )
    for row in open_rows.scalars().all():
        row.end_time = body.start_time

    if body.end_time is not None and body.end_time <= body.start_time:
        raise HTTPException(400, detail="end_time must be after start_time")

    assignment = DriverAssignment(
        device_imei=body.device_imei,
        driver_name=body.driver_name,
        driver_doc=body.driver_doc,
        start_time=body.start_time,
        end_time=body.end_time,
        notes=body.notes,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


@router.put("/assignments/{assignment_id}", response_model=DriverAssignmentResponse)
async def update_assignment(
    assignment_id: int,
    body: DriverAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Edit an assignment. Admin only."""
    result = await db.execute(select(DriverAssignment).where(DriverAssignment.id == assignment_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, detail=f"Assignment {assignment_id} not found")
    if body.end_time is not None and body.end_time <= body.start_time:
        raise HTTPException(400, detail="end_time must be after start_time")
    row.device_imei = body.device_imei
    row.driver_name = body.driver_name
    row.driver_doc = body.driver_doc
    row.start_time = body.start_time
    row.end_time = body.end_time
    row.notes = body.notes
    await db.flush()
    await db.refresh(row)
    return row


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Delete an assignment. Admin only."""
    result = await db.execute(select(DriverAssignment).where(DriverAssignment.id == assignment_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, detail=f"Assignment {assignment_id} not found")
    await db.delete(row)
    await db.flush()
    return None