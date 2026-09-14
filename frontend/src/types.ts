export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor';
  sector_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface UserListResponse {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor';
  sector_id: number | null;
  sector_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'supervisor';
  sector_id: number | null;
}

export interface UserUpdatePayload {
  name?: string;
  role?: 'admin' | 'supervisor';
  sector_id?: number | null;
  is_active?: boolean;
}

export type DeviceStatus =
  | 'online'
  | 'offline'
  | 'moving'
  | 'stationary'
  | 'overspeed'
  | 'acc_on'
  | 'expired'
  | 'inactive';

export interface Device {
  id: number;
  imei: string;
  device_name: string | null;
  driver_name: string | null;
  plate_no: string | null;
  org_id: number | null;
  last_online_time: string | null;
  active_time: string | null;
  avatar: string | null;
  icon_name: string | null;
  over_speed: number | null;
  fuel_value: number | null;
  sim: string | null;
  iccid: string | null;
  car_vin: string | null;
  sector_id: number | null;
  updated_at: string;
  status?: DeviceStatus;
}

export interface DeviceListResponse {
  total: number;
  devices: Device[];
}

export interface GpsPosition {
  id: number;
  device_imei: string;
  lat: number;
  lon: number;
  speed: number | null;
  gps_time: string | null;
  odometer: number | null;
  status1: number | null;
  mask1: number | null;
  acc_on: boolean | null;
  warn_ids: number[] | null;
  updated_at: string;
}

export interface TrackRequest {
  org_id: number;
  last_query_time?: string | null;
}

export interface TrackResponse {
  total: number;
  positions: GpsPosition[];
  last_query_time: string | null;
}

export interface Sector {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical' | 'info' | 'warning';

export interface Alert {
  id: number;
  device_imei: string;
  alert_type: string;
  message: string | null;
  severity: AlertSeverity;
  acknowledged_by: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

export interface AlertListResponse {
  total: number;
  alerts: Alert[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface CommandLog {
  id: number;
  user_id: string | null;
  device_imei: string;
  command_type: number;
  ibutton_id: string | null;
  status: 'pending' | 'sent' | 'confirmed' | 'failed';
  result_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CommandListResponse {
  total: number;
  commands: CommandLog[];
}

export interface BatchOperation {
  imei: string;
  ibutton_id: string;
  action: 'add' | 'remove';
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  commands: CommandLog[];
}

export interface UploadResult {
  total_rows: number;
  processed: number;
  succeeded: number;
  failed: number;
  commands: CommandLog[];
}