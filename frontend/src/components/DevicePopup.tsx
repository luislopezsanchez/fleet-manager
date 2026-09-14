import { useTranslation } from 'react-i18next';
import type { Device, GpsPosition } from '../types';

// Istarmap alarm IDs (API doc)
const ALARM_LABELS: Record<number, { key: string; sev: 'info' | 'warn' | 'crit' }> = {
  1017: { key: 'alarm_1017', sev: 'warn' },
  1018: { key: 'alarm_1018', sev: 'crit' },
  1020: { key: 'alarm_1020', sev: 'warn' },
  1021: { key: 'alarm_1021', sev: 'crit' },
  1022: { key: 'alarm_1022', sev: 'warn' },
  1025: { key: 'alarm_1025', sev: 'warn' },
  1026: { key: 'alarm_1026', sev: 'info' },
  1027: { key: 'alarm_1027', sev: 'warn' },
  1033: { key: 'alarm_1033', sev: 'crit' },
  1035: { key: 'alarm_1035', sev: 'crit' },
  1038: { key: 'alarm_1038', sev: 'warn' },
  1041: { key: 'alarm_1041', sev: 'warn' },
  1042: { key: 'alarm_1042', sev: 'crit' },
  1043: { key: 'alarm_1043', sev: 'crit' },
  1045: { key: 'alarm_1045', sev: 'crit' },
};

interface Row {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'crit' | 'muted';
}

export default function DevicePopup({ device, pos }: { device?: Device; pos: GpsPosition }) {
  const { t } = useTranslation();

  const volt = (v: number | null | undefined, digits = 1) =>
    v != null ? `${(v / 100).toFixed(digits)} V` : '—';

  // status chips
  const chips: { text: string; cls: string }[] = [];
  const speed = pos.speed ?? 0;
  const overLimit = device?.over_speed ?? null;
  const isMoving = speed > 0;
  const isOver = overLimit != null && speed > overLimit;

  if (isOver) chips.push({ text: t('status.overspeed'), cls: 'bg-red-100 text-red-700 border-red-300' });
  else if (isMoving) chips.push({ text: t('status.moving'), cls: 'bg-green-100 text-green-700 border-green-300' });
  else if (pos.acc_on) chips.push({ text: t('status.acc_on'), cls: 'bg-blue-100 text-blue-700 border-blue-300' });
  else chips.push({ text: t('status.stationary'), cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' });

  if (pos.acc_on === null) chips.push({ text: t('popup.acc_unknown'), cls: 'bg-gray-100 text-gray-500 border-gray-300' });

  // rows: vehicle info
  const rows: Row[] = [
    { label: t('devices.plate'), value: device?.plate_no || '—' },
    { label: t('devices.driver'), value: device?.driver_name || '—' },
    {
      label: t('popup.speed'),
      value: `${speed.toFixed(1)} km/h${overLimit != null ? ` / ${overLimit}` : ''}`,
      tone: isOver ? 'crit' : isMoving ? 'ok' : 'muted',
    },
    { label: t('popup.gps_time'), value: pos.gps_time || '—' },
    { label: t('devices.last_seen'), value: pos.last_online_time || device?.last_online_time || '—' },
  ];

  // telemetry section (only if data present)
  const hasTelemetry =
    pos.engine_rpm != null || pos.coolant_temp != null || pos.engine_load != null ||
    pos.fuel_liters != null || pos.fuel_level != null || pos.instant_fuel != null ||
    pos.odometer != null;

  const telemetryRows: Row[] = [];
  if (pos.odometer != null) telemetryRows.push({ label: t('popup.odometer'), value: `${pos.odometer.toLocaleString()} km` });
  if (pos.engine_rpm != null) telemetryRows.push({ label: t('popup.rpm'), value: `${pos.engine_rpm} rpm` });
  if (pos.coolant_temp != null) telemetryRows.push({
    label: t('popup.coolant'),
    value: `${pos.coolant_temp} °C`,
    tone: pos.coolant_temp > 105 ? 'crit' : pos.coolant_temp > 95 ? 'warn' : 'ok',
  });
  if (pos.engine_load != null) telemetryRows.push({ label: t('popup.load'), value: `${pos.engine_load}%` });
  if (pos.fuel_liters != null) telemetryRows.push({ label: t('popup.fuel'), value: `${pos.fuel_liters} L` });
  if (pos.fuel_level != null) telemetryRows.push({ label: t('popup.fuel_level'), value: `${pos.fuel_level}` });
  if (pos.instant_fuel != null) telemetryRows.push({ label: t('popup.instant_fuel'), value: `${pos.instant_fuel} L/h` });

  // device/gps section
  const gpsRows: Row[] = [
    { label: 'IMEI', value: pos.device_imei },
  ];
  if (pos.angle != null) gpsRows.push({ label: t('popup.heading'), value: `${Math.round(pos.angle)}°` });
  if (pos.altitude != null) gpsRows.push({ label: t('popup.altitude'), value: `${pos.altitude} m` });
  if (pos.satellites != null) gpsRows.push({ label: t('popup.satellites'), value: String(pos.satellites) });
  if (pos.gsm_signal != null) gpsRows.push({ label: t('popup.gsm'), value: String(pos.gsm_signal) });
  if (pos.ext_voltage != null) gpsRows.push({
    label: t('popup.ext_voltage'),
    value: volt(pos.ext_voltage),
    tone: pos.ext_voltage < 1100 ? 'crit' : 'ok',
  });
  if (pos.bat_voltage != null) gpsRows.push({ label: t('popup.bat_voltage'), value: volt(pos.bat_voltage) });

  // alarms
  const alarms = (pos.warn_ids || []).map((id) => ALARM_LABELS[id]).filter(Boolean);

  const toneCls: Record<string, string> = {
    ok: 'text-gray-700',
    warn: 'text-yellow-600 font-medium',
    crit: 'text-red-600 font-semibold',
    muted: 'text-gray-500',
  };

  return (
    <div className="text-sm min-w-[240px]">
      <div className="font-semibold text-gray-900 text-base mb-1">
        {device?.device_name || pos.device_name || pos.device_imei}
      </div>

      {/* status chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        {chips.map((c) => (
          <span key={c.text} className={`px-2 py-0.5 rounded-full text-xs border ${c.cls}`}>{c.text}</span>
        ))}
      </div>

      {/* alarms */}
      {alarms.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {alarms.map((a, i) => (
            <div key={i} className={`text-xs ${a.sev === 'crit' ? 'text-red-600 font-semibold' : 'text-yellow-600'}`}>
              ⚠ {t(`alarms.${a.key}`)}
            </div>
          ))}
        </div>
      )}

      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-3 py-0.5 text-gray-500 align-top whitespace-nowrap">{r.label}</td>
              <td className={`py-0.5 ${toneCls[r.tone || 'ok']}`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasTelemetry && (
        <>
          <div className="mt-2 pt-2 border-t border-gray-200 text-xs font-semibold text-gray-600">
            {t('popup.telemetry')}
          </div>
          <table className="w-full text-xs">
            <tbody>
              {telemetryRows.map((r) => (
                <tr key={r.label}>
                  <td className="pr-3 py-0.5 text-gray-500 align-top whitespace-nowrap">{r.label}</td>
                  <td className={`py-0.5 ${toneCls[r.tone || 'ok']}`}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-2 pt-2 border-t border-gray-200 text-xs font-semibold text-gray-600">
        {t('popup.device_gps')}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {gpsRows.map((r) => (
            <tr key={r.label}>
              <td className="pr-3 py-0.5 text-gray-500 align-top whitespace-nowrap">{r.label}</td>
              <td className={`py-0.5 ${toneCls[r.tone || 'ok']}`}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}