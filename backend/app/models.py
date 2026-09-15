"""SQLAlchemy ORM models for the fleet-manager backend."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ──────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    admin = "admin"
    supervisor = "supervisor"


class CommandStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    confirmed = "confirmed"
    failed = "failed"


# ── Sector ─────────────────────────────────────────────────────────────────
class Sector(Base):
    __tablename__ = "sectors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship(back_populates="sector")


# ── User ───────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.supervisor,
    )
    sector_id: Mapped[int | None] = mapped_column(
        ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sector: Mapped[Sector | None] = relationship(back_populates="users")


# ── DeviceCache (synced from istarmap) ─────────────────────────────────────
class DeviceCache(Base):
    __tablename__ = "device_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    imei: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    driver_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plate_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    org_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    last_online_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    active_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    over_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fuel_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    sim: Mapped[str | None] = mapped_column(String(30), nullable=True)
    iccid: Mapped[str | None] = mapped_column(String(30), nullable=True)
    car_vin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sector_id: Mapped[int | None] = mapped_column(
        ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # local-only flag: devices deleted in the UI are excluded from lists and
    # re-creation by the hourly istarmap sync (istarmap API has no device CRUD)
    is_excluded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sector: Mapped[Sector | None] = relationship()


# ── GpsCache (latest GPS positions) ────────────────────────────────────────
class GpsCache(Base):
    __tablename__ = "gps_cache"

    id: Mapped[BigInteger] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)          # km/h
    gps_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    odometer: Mapped[float | None] = mapped_column(Float, nullable=True)       # km
    status1: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mask1: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acc_on: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    warn_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # ── extended fields from GpsTrackVo ──
    angle: Mapped[float | None] = mapped_column(Float, nullable=True)          # heading deg
    altitude: Mapped[float | None] = mapped_column(Float, nullable=True)       # meters
    satellites: Mapped[int | None] = mapped_column(Integer, nullable=True)     # quantity
    gsm_signal: Mapped[int | None] = mapped_column(Integer, nullable=True)     # csqQuantity
    ext_voltage: Mapped[int | None] = mapped_column(Float, nullable=True)      # 0.01V
    bat_voltage: Mapped[float | None] = mapped_column(Float, nullable=True)    # 0.01V
    fuel_liters: Mapped[float | None] = mapped_column(Float, nullable=True)    # liters
    validity: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_online_time: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # ── OBD (ObdDataDto) ──
    engine_rpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    coolant_temp: Mapped[float | None] = mapped_column(Float, nullable=True)   # °C
    engine_load: Mapped[float | None] = mapped_column(Float, nullable=True)    # %
    fuel_level: Mapped[str | None] = mapped_column(String(20), nullable=True)  # OBD string
    instant_fuel: Mapped[float | None] = mapped_column(Float, nullable=True)   # L/h
    obd_speed: Mapped[int | None] = mapped_column(Integer, nullable=True)      # km/h
    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── CommandLog ─────────────────────────────────────────────────────────────
class CommandLog(Base):
    __tablename__ = "command_logs"

    id: Mapped[BigInteger] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    command_type: Mapped[int] = mapped_column(Integer, nullable=False)  # 144 / 145 / 146
    ibutton_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[CommandStatus] = mapped_column(
        Enum(CommandStatus, name="command_status"),
        nullable=False,
        default=CommandStatus.pending,
    )
    result_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── Alert ──────────────────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[BigInteger] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)  # inactivity / speed / geofence / etc
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")  # info / warning / critical
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ── SystemConfig (key-value store for runtime settings) ─────────────────────
class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── Geofence (local, evaluated on each tracker poll) ───────────────────────
class Geofence(Base):
    __tablename__ = "geofences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    shape: Mapped[str] = mapped_column(String(20), nullable=False, default="circle")  # circle | polygon
    # circle fields
    center_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    radius_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    # polygon: list of [lat, lon] pairs
    polygon: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#3b82f6")
    alert_on: Mapped[str] = mapped_column(String(10), nullable=False, default="both")  # entry | exit | both
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class GeofenceEvent(Base):
    __tablename__ = "geofence_events"

    id: Mapped[BigInteger] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    geofence_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("geofences.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(10), nullable=False)  # entry | exit
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    geofence: Mapped["Geofence"] = relationship()

# ── DriverAssignment (who drove which vehicle, when) ────────────────────────
class DriverAssignment(Base):
    __tablename__ = "driver_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_imei: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    driver_name: Mapped[str] = mapped_column(String(255), nullable=False)
    driver_doc: Mapped[str | None] = mapped_column(String(100), nullable=True)  # DNI/licencia
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # NULL = current
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
