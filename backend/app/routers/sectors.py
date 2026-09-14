"""Sectors router: full CRUD, admin-only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import role_required
from app.database import get_db
from app.models import Sector, User
from app.schemas import SectorCreate, SectorResponse, SectorUpdate

router = APIRouter(prefix="/sectors", tags=["sectors"])


@router.get("/", response_model=list[SectorResponse])
async def list_sectors(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin", "supervisor")),
):
    result = await db.execute(select(Sector).order_by(Sector.name))
    return result.scalars().all()


@router.post("/", response_model=SectorResponse, status_code=status.HTTP_201_CREATED)
async def create_sector(
    body: SectorCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    existing = await db.execute(select(Sector).where(Sector.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sector '{body.name}' already exists",
        )

    sector = Sector(name=body.name, description=body.description)
    db.add(sector)
    await db.flush()
    await db.refresh(sector)
    return sector


@router.put("/{sector_id}", response_model=SectorResponse)
async def update_sector(
    sector_id: int,
    body: SectorUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    result = await db.execute(select(Sector).where(Sector.id == sector_id))
    sector = result.scalar_one_or_none()
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sector {sector_id} not found",
        )

    if body.name is not None:
        # Check name uniqueness if changed
        if body.name != sector.name:
            dup = await db.execute(select(Sector).where(Sector.name == body.name))
            if dup.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Sector '{body.name}' already exists",
                )
        sector.name = body.name
    if body.description is not None:
        sector.description = body.description

    await db.flush()
    await db.refresh(sector)
    return sector


@router.delete("/{sector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sector(
    sector_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    result = await db.execute(select(Sector).where(Sector.id == sector_id))
    sector = result.scalar_one_or_none()
    if not sector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sector {sector_id} not found",
        )

    await db.delete(sector)