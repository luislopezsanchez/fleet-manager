"""Pydantic v2 schemas for request/response validation."""
import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Auth ───────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user: "UserResponse"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "supervisor"  # admin | supervisor
    sector_id: Optional[int] = None
    is_active: bool = True


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    sector_id: Optional[int] = None
    is_active: bool
    created_at: datetime


# ── Sectors ────────────────────────────────────────────────────────────────
class SectorCreate(BaseModel):
    name: str
    description: Optional[str] = None


class SectorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class SectorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime


# ── Devices ────────────────────────────────────────────────────────────────
class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    imei: str
    device_name: Optional[str] = None
    driver_name: Optional[str] = None
    plate_no: Optional[str] = None
    org_id: Optional[int] = None
    last_online_time: Optional[str] = None
    active_time: Optional[str] = None
    avatar: Optional[str] = None
    icon_name: Optional[str] = None
    over_speed: Optional[int] = None
    fuel_value: Optional[float] = None
    sim: Optional[str] = None
    iccid: Optional[str] = None
    car_vin: Optional[str] = None
    sector_id: Optional[int] = None
    updated_at: datetime


class DeviceListResponse(BaseModel):
    total: int
    devices: List[DeviceResponse]


class DeviceSyncResponse(BaseModel):
    synced: int
    total: int
    message: str


# ── GPS ────────────────────────────────────────────────────────────────────
class GpsPosition(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_imei: str
    lat: float
    lon: float
    speed: Optional[float] = None                 # km/h
    gps_time: Optional[str] = None
    odometer: Optional[float] = None              # km
    status1: Optional[int] = None
    mask1: Optional[int] = None
    acc_on: Optional[bool] = None
    warn_ids: Optional[List[int]] = None
    # ── extended fields from GpsTrackVo ──
    angle: Optional[float] = None                 # heading deg
    altitude: Optional[float] = None              # meters
    satellites: Optional[int] = None
    gsm_signal: Optional[int] = None
    ext_voltage: Optional[float] = None           # 0.01V units
    bat_voltage: Optional[float] = None           # 0.01V units
    fuel_liters: Optional[float] = None           # liters
    validity: Optional[bool] = None
    device_name: Optional[str] = None
    last_online_time: Optional[str] = None
    # ── OBD ──
    engine_rpm: Optional[int] = None
    coolant_temp: Optional[float] = None          # °C
    engine_load: Optional[float] = None           # %
    fuel_level: Optional[str] = None
    instant_fuel: Optional[float] = None          # L/h
    obd_speed: Optional[int] = None               # km/h
    updated_at: datetime


class TrackRequest(BaseModel):
    org_id: int
    last_query_time: Optional[str] = None  # yyyy-MM-ddTHH:mm:ssZ


class TrackResponse(BaseModel):
    total: int
    positions: List[GpsPosition]
    last_query_time: Optional[str] = None


# ── Commands ───────────────────────────────────────────────────────────────
class CommandRequest(BaseModel):
    imei: str
    command_type: int = Field(description="144=Aerial, 145=Relay, 146=Param query")
    ibutton_id: Optional[str] = None
    params: Optional[dict[str, Any]] = None


class CommandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[uuid.UUID] = None
    device_imei: str
    command_type: int
    ibutton_id: Optional[str] = None
    status: str
    result_data: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# ── Alerts ─────────────────────────────────────────────────────────────────
class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_imei: str
    alert_type: str
    message: Optional[str] = None
    severity: str
    acknowledged_by: Optional[uuid.UUID] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None


class AlertListResponse(BaseModel):
    total: int
    alerts: List[AlertResponse]


class AlertStatsResponse(BaseModel):
    total: int
    by_severity: dict[str, int]
    by_type: dict[str, int]
    unacknowledged: int


# ── User Management ────────────────────────────────────────────────────────
class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "supervisor"  # admin | supervisor
    sector_id: Optional[int] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    sector_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    role: str
    sector_id: Optional[int] = None
    sector_name: Optional[str] = None
    is_active: bool
    created_at: datetime


# ── Device Sector Assignment ───────────────────────────────────────────────
class DeviceSectorAssignRequest(BaseModel):
    sector_id: Optional[int] = None  # None = unassign


class VehicleUpdateRequest(BaseModel):
    device_name: Optional[str] = None
    driver_name: Optional[str] = None
    plate_no: Optional[str] = None
    sector_id: Optional[int] = None
    over_speed: Optional[int] = None
    sim: Optional[str] = None
    car_vin: Optional[str] = None


class VehicleCreateRequest(BaseModel):
    imei: str = Field(min_length=10, max_length=20)
    device_name: Optional[str] = None
    driver_name: Optional[str] = None
    plate_no: Optional[str] = None
    org_id: Optional[int] = None
    sector_id: Optional[int] = None
    over_speed: Optional[int] = None
    sim: Optional[str] = None
    car_vin: Optional[str] = None


# ── Playback / History / Terminal control ──────────────────────────────────
class HistoryRequest(BaseModel):
    imei: str
    start_time: str  # yyyy-MM-ddTHH:mm:ssZ (UTC)
    end_time: str
    filter_drift: bool = True


class HistoryPoint(BaseModel):
    lat: float
    lon: float
    speed: Optional[float] = None  # km/h
    gps_time: Optional[str] = None
    angle: Optional[float] = None
    status1: Optional[int] = None
    mask1: Optional[int] = None
    odometer: Optional[float] = None  # km
    satellites: Optional[int] = None
    ext_voltage: Optional[float] = None  # 0.01V


class HistoryResponse(BaseModel):
    total: int
    points: List[HistoryPoint]


class TermCtrlRequest(BaseModel):
    imei: str
    ctrl_type: str  # OIL_ELE_CUT | OIL_ELE_RECOVER


class TermCtrlResponse(BaseModel):
    request_id: Optional[str] = None
    result: Optional[str] = None  # SUCCESS | OFF_LINE | FAIL
    message: Optional[str] = None


class CommandResultResponse(BaseModel):
    request_id: Optional[str] = None
    result: Optional[str] = None
    raw: Optional[dict[str, Any]] = None


# ── Geofences ───────────────────────────────────────────────────────────────
class GeofenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    shape: str  # circle | polygon
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius_m: Optional[float] = None
    polygon: Optional[List[List[float]]] = None  # [[lat, lon], ...]
    color: str = "#3b82f6"
    alert_on: str = "both"  # entry | exit | both
    is_active: bool = True


class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    alert_on: Optional[str] = None
    is_active: Optional[bool] = None
    radius_m: Optional[float] = None
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None


class GeofenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    shape: str
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius_m: Optional[float] = None
    polygon: Optional[List[List[float]]] = None
    color: str
    alert_on: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GeofenceEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_imei: str
    geofence_id: int
    event_type: str
    lat: float
    lon: float
    speed: Optional[float] = None
    created_at: datetime
    geofence_name: Optional[str] = None
    device_name: Optional[str] = None


# ── Forward refs ───────────────────────────────────────────────────────────
TokenResponse.model_rebuild()