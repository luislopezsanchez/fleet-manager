"""Users router: CRUD for user management, admin only."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import hash_password, role_required
from app.database import get_db
from app.models import Sector, User, UserRole
from app.schemas import (
    UserCreateRequest,
    UserListResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["users"])


async def _build_user_response(user: User, db: AsyncSession) -> UserListResponse:
    """Build a UserListResponse, including the sector name if sector_id is set."""
    sector_name = None
    if user.sector_id is not None:
        sector_result = await db.execute(
            select(Sector.name).where(Sector.id == user.sector_id)
        )
        sector_name = sector_result.scalar_one_or_none()

    return UserListResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        sector_id=user.sector_id,
        sector_name=sector_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("/", response_model=list[UserListResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """List all users. Admin only."""
    result = await db.execute(
        select(User).options(selectinload(User.sector)).order_by(User.name)
    )
    users = result.scalars().all()

    responses = []
    for user in users:
        sector_name = user.sector.name if user.sector else None
        responses.append(
            UserListResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                role=user.role.value,
                sector_id=user.sector_id,
                sector_name=sector_name,
                is_active=user.is_active,
                created_at=user.created_at,
            )
        )
    return responses


@router.post("/", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Create a new user. Admin only."""
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate role
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(r.value for r in UserRole)}",
        )

    # If sector_id provided, validate it exists
    if body.sector_id is not None:
        sector_result = await db.execute(select(Sector).where(Sector.id == body.sector_id))
        if not sector_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sector {body.sector_id} not found",
            )

    user = User(
        id=uuid.uuid4(),
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
        role=role,
        sector_id=body.sector_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return await _build_user_response(user, db)


@router.put("/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(role_required("admin")),
):
    """Update a user. Admin only. Does not update password."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    if body.name is not None:
        user.name = body.name

    if body.role is not None:
        try:
            user.role = UserRole(body.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{body.role}'. Must be one of: {', '.join(r.value for r in UserRole)}",
            )

    if body.sector_id is not None:
        # Validate sector exists
        sector_result = await db.execute(select(Sector).where(Sector.id == body.sector_id))
        if not sector_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sector {body.sector_id} not found",
            )
        user.sector_id = body.sector_id

    if body.is_active is not None:
        user.is_active = body.is_active

    await db.flush()
    await db.refresh(user)
    return await _build_user_response(user, db)


@router.delete("/{user_id}", response_model=UserListResponse)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(role_required("admin")),
):
    """Deactivate a user (soft delete). Admin only. Does not actually delete the record."""
    # Prevent self-deactivation
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found",
        )

    user.is_active = not user.is_active  # Toggle active/inactive
    await db.flush()
    await db.refresh(user)
    return await _build_user_response(user, db)