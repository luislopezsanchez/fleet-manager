import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { DeviceListResponse, Device, GpsPosition, AlertListResponse, Alert, HistoryResponse, HistoryPoint, TermCtrlResponse } from '../types';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const makeIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const iconMoving = makeIcon('#22c55e');
const iconStationary = makeIcon('#eab308');
const iconAccOn = makeIcon('#3b82f6');
const playbackIcon = makeIcon('#2563eb');

function getMarkerIcon(pos: GpsPosition): L.DivIcon {
  if (pos.speed && pos.speed > 0) return iconMoving;
  if (pos.acc_on) return iconAccOn;
  return iconStationary;
}

// Fit map to a polyline
function FitLine({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, points.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// speed → polyline color
const speedColor = (s: number | null | undefined) => {
  const v = s ?? 0;
  if (v > 90) return '#ef4444';
  if (v > 50) return '#f97316';
  if (v > 0) return '#22c55e';
  return '#eab308';
};

function toUTCInputValue(d: Date): string {
  return d.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
}

export default function DeviceDetailPage() {
  const { imei } = useParams<{ imei: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [device, setDevice] = useState<Device | null>(null);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // playback state
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 24 * 3600 * 1000);
  const [pbStart, setPbStart] = useState(toUTCInputValue(defaultStart));
  const [pbEnd, setPbEnd] = useState(toUTCInputValue(now));
  const [pbLoading, setPbLoading] = useState(false);
  const [pbError, setPbError] = useState('');
  const [pbNotice, setPbNotice] = useState('');
  const [pbPoints, setPbPoints] = useState<HistoryPoint[]>([]);
  const [pbIndex, setPbIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pbSpeed, setPbSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  // commands state
  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdMsg, setCmdMsg] = useState('');
  const [cmdErr, setCmdErr] = useState('');
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const fetchDevice = useCallback(async () => {
    if (!imei) return;
    try {
      const devRes = await api.get<DeviceListResponse>('/devices/');
      const dev = devRes.data.devices.find((d) => d.imei === imei);
      if (!dev) {
        setError('Device not found');
        setDevice(null);
        return;
      }
      setDevice(dev);

      try {
        const posRes = await api.get<GpsPosition>(`/devices/${imei}/position`);
        setPosition(posRes.data);
      } catch {
        setPosition(null);
      }

      try {
        const alertsRes = await api.get<AlertListResponse>('/alerts/', {
          params: { limit: 20 },
        });
        setAlerts(alertsRes.data.alerts.filter((a) => a.device_imei === imei));
      } catch {
        setAlerts([]);
      }
      setError('');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [imei, t]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  // playback timer
  useEffect(() => {
    if (playing && pbPoints.length > 1) {
      const step = Math.max(1, Math.round(pbSpeed * (pbPoints.length / 300))); // faster on long tracks
      timerRef.current = window.setInterval(() => {
        setPbIndex((i) => {
          if (i >= pbPoints.length - 1) {
            setPlaying(false);
            return i;
          }
          return Math.min(i + step, pbPoints.length - 1);
        });
      }, 400);
    }
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, pbPoints.length, pbSpeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlayback = async () => {
    if (!imei) return;
    setPbLoading(true);
    setPbError('');
    setPbNotice('');
    setPlaying(false);
    try {
      // istarmap requires yyyy-MM-ddTHH:mm:ssZ exactly. The datetime-local input
      // omits seconds when they are :00 (and toISOString() adds milliseconds):
      // normalize both cases or istarmap answers 400.
      const fmt = (v: string) => {
        const m = v.replace(/\.\d+/, '').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/);
        if (!m) return v + 'Z';
        return `${m[1]}:${m[2] ?? '00'}Z`;
      };
      const res = await api.post<HistoryResponse>(`/devices/${imei}/history`, {
        imei,
        start_time: fmt(pbStart),
        end_time: fmt(pbEnd),
        filter_drift: true,
      });
      const raw = res.data.points;
      // Downsample very large tracks (e.g. 60k pts/week): rendering every point
      // freezes the map. Keep endpoints, sample the rest, cap at ~1500.
      const MAX_POINTS = 1500;
      let pts = raw;
      if (raw.length > MAX_POINTS) {
        const step = raw.length / MAX_POINTS;
        pts = Array.from({ length: MAX_POINTS }, (_, i) =>
          raw[Math.round(i * step)]
        );
        if (pts[pts.length - 1] !== raw[raw.length - 1]) pts[pts.length - 1] = raw[raw.length - 1];
      }
      setPbPoints(pts);
      setPbIndex(0);
      if (raw.length === 0) {
        setPbError(t('vehicles.no_track'));
      } else if (raw.length > MAX_POINTS) {
        setPbNotice(t('vehicles.downsampled', { shown: pts.length, total: raw.length }));
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      setPbError(`${t('common.error')}: ${typeof detail === 'string' ? detail : t('vehicles.no_track')}`);
    } finally {
      setPbLoading(false);
    }
  };

  const sendCommand = async (ctrlType: 'OIL_ELE_CUT' | 'OIL_ELE_RECOVER') => {
    if (!imei) return;
    const name = device?.device_name || imei;
    const confirmMsg =
      ctrlType === 'OIL_ELE_CUT'
        ? t('vehicles.cmd_confirm_cut', { name })
        : t('vehicles.cmd_confirm_recover', { name });
    if (!window.confirm(confirmMsg)) return;

    setCmdBusy(true);
    setCmdMsg('');
    setCmdErr('');
    try {
      const res = await api.post<TermCtrlResponse>(`/devices/${imei}/command`, {
        imei,
        ctrl_type: ctrlType,
      });
      setLastRequestId(res.data.request_id);
      if (res.data.result === 'SUCCESS') {
        setCmdMsg(`${t('vehicles.cmd_sent')} ✓ (requestId: ${res.data.request_id || '—'})`);
      } else if (res.data.result === 'OFF_LINE') {
        setCmdErr(t('vehicles.cmd_offline'));
      } else {
        setCmdErr(res.data.result === 'FAIL' ? t('vehicles.cmd_fail') : `${t('vehicles.cmd_result')}: ${res.data.result || '—'}`);
      }
    } catch {
      setCmdErr(t('common.error'));
    } finally {
      setCmdBusy(false);
    }
  };

  const checkCommandResult = async () => {
    if (!imei || !lastRequestId) return;
    setCmdBusy(true);
    try {
      const res = await api.get<TermCtrlResponse>(`/devices/${imei}/command_result`, {
        params: { request_id: lastRequestId },
      });
      setCmdMsg(`${t('vehicles.cmd_result')}: ${res.data.result || '—'}`);
    } catch {
      setCmdErr(t('common.error'));
    } finally {
      setCmdBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !device) {
    return (
      <div>
        <button
          onClick={() => navigate('/devices')}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('vehicles.title')}
        </button>
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  const current = pbPoints[pbIndex];
  const lineCoords: [number, number][] = pbPoints.map((p) => [p.lat, p.lon]);
  // split polyline into segments by speed color
  const segments: { coords: [number, number][]; color: string }[] = [];
  for (let i = 1; i < pbPoints.length; i++) {
    const a = pbPoints[i - 1];
    const b = pbPoints[i];
    const color = speedColor(Math.max(a.speed ?? 0, b.speed ?? 0));
    const last = segments[segments.length - 1];
    if (last && last.color === color) {
      last.coords.push([b.lat, b.lon]);
    } else {
      segments.push({ coords: [[a.lat, a.lon], [b.lat, b.lon]], color });
    }
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/devices')}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('vehicles.title')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('vehicles.info')}</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('devices.name')}</label>
              <p className="text-sm font-medium text-gray-800">{device?.device_name || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">IMEI</label>
              <p className="text-sm font-mono text-gray-700">{device?.imei}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('devices.plate')}</label>
              <p className="text-sm text-gray-700">{device?.plate_no || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('devices.driver')}</label>
              <p className="text-sm text-gray-700">{device?.driver_name || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">SIM</label>
              <p className="text-sm text-gray-700">{device?.sim || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">VIN</label>
              <p className="text-sm text-gray-700">{device?.car_vin || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">ICCID</label>
              <p className="text-sm text-gray-700">{device?.iccid || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('devices.last_seen')}</label>
              <p className="text-sm text-gray-700">
                {device?.last_online_time ? new Date(device.last_online_time).toLocaleString() : '—'}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('popup.over_speed')}</label>
              <p className="text-sm text-gray-700">{device?.over_speed ?? '—'} km/h</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">{t('popup.fuel_short')}</label>
              <p className="text-sm text-gray-700">{device?.fuel_value ? device.fuel_value : '—'}</p>
            </div>
          </div>

          {/* Commands */}
          {isAdmin && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('vehicles.commands')}</h3>
              <p className="text-xs text-gray-400 mb-3">{t('vehicles.commands_subtitle')}</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => sendCommand('OIL_ELE_RECOVER')}
                  disabled={cmdBusy}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {t('vehicles.cmd_recover')}
                </button>
                <button
                  onClick={() => sendCommand('OIL_ELE_CUT')}
                  disabled={cmdBusy}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {t('vehicles.cmd_cut')}
                </button>
                {lastRequestId && (
                  <button
                    onClick={checkCommandResult}
                    disabled={cmdBusy}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {t('vehicles.cmd_check')}
                  </button>
                )}
              </div>
              {cmdMsg && <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{cmdMsg}</div>}
              {cmdErr && <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cmdErr}</div>}
            </div>
          )}
        </div>

        {/* Mini Map (live position) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('map.title')}</h2>
          <div className="w-full flex-1 min-h-[320px] rounded-lg overflow-hidden border border-gray-200">
            {position ? (
              <MapContainer
                center={[position.lat, position.lon]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                  maxZoom={19}
                />
                <Marker
                  position={[position.lat, position.lon]}
                  icon={getMarkerIcon(position)}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{device?.device_name || device?.imei}</strong><br />
                      {t('popup.speed')}: {position.speed?.toFixed(1) || 0} km/h<br />
                      GPS Time: {position.gps_time || '—'}<br />
                      {t('popup.odometer')}: {position.odometer?.toFixed(1) || 0} km
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <p className="text-gray-400 text-sm">No GPS position available</p>
              </div>
            )}
          </div>

          {position && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">{t('popup.speed')}</label>
                <p className="text-sm font-medium text-gray-800">{position.speed?.toFixed(1) || 0} km/h</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">{t('popup.latlon')}</label>
                <p className="text-sm font-medium text-gray-800">
                  {position.lat.toFixed(4)}, {position.lon.toFixed(4)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">{t('popup.odometer')}</label>
                <p className="text-sm font-medium text-gray-800">{position.odometer?.toFixed(1) || 0} km</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">{t('popup.ignition')}</label>
                <p className="text-sm font-medium text-gray-800">
                  {position.acc_on ? t('popup.on') : t('popup.off')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Playback */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-1">{t('vehicles.playback')}</h2>
        <p className="text-sm text-gray-400 mb-4">{t('vehicles.playback_subtitle')}</p>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.start')} (UTC)</label>
            <input
              type="datetime-local"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={pbStart}
              onChange={(e) => setPbStart(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.end')} (UTC)</label>
            <input
              type="datetime-local"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={pbEnd}
              onChange={(e) => setPbEnd(e.target.value)}
            />
          </div>
          <button
            onClick={loadPlayback}
            disabled={pbLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {pbLoading ? t('common.loading') : t('vehicles.load')}
          </button>
          {pbPoints.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaying(!playing)}
                className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-3 py-2 rounded-lg text-sm"
              >
                {playing ? `⏸ ${t('vehicles.pause')}` : `▶ ${t('vehicles.play')}`}
              </button>
              <button
                onClick={() => { setPlaying(false); setPbIndex(0); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-3 py-2 rounded-lg text-sm"
              >
                ⏹ {t('vehicles.stop')}
              </button>
              <select
                value={pbSpeed}
                onChange={(e) => setPbSpeed(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                title={t('vehicles.speed')}
              >
                {[1, 2, 4, 8, 16].map((s) => (
                  <option key={s} value={s}>{s}×</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {pbError && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded-lg text-sm mb-3">
            {pbError}
          </div>
        )}

        {pbNotice && !pbError && (
          <div className="bg-blue-50 border border-blue-200 text-blue-600 px-3 py-2 rounded-lg text-xs mb-3">
            {pbNotice}
          </div>
        )}

        {pbPoints.length > 0 && (
          <>
            <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200 mb-3">
              <MapContainer
                center={[pbPoints[0].lat, pbPoints[0].lon]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; OpenStreetMap contributors'
                  maxZoom={19}
                />
                <FitLine points={lineCoords} />
                {segments.map((seg, i) => (
                  <Polyline key={i} positions={seg.coords} pathOptions={{ color: seg.color, weight: 4 }} />
                ))}
                {pbPoints.map((p, i) => (
                  <CircleMarker
                    key={i}
                    center={[p.lat, p.lon]}
                    radius={i === pbIndex ? 6 : 2}
                    pathOptions={{ color: i === pbIndex ? '#2563eb' : '#9ca3af', fillColor: i === pbIndex ? '#2563eb' : '#9ca3af', fillOpacity: 1 }}
                  />
                ))}
                {current && (
                  <Marker position={[current.lat, current.lon]} icon={playbackIcon}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{device?.device_name || imei}</strong><br />
                        {current.gps_time || '—'}<br />
                        {current.speed?.toFixed(1) ?? 0} km/h<br />
                        {t('popup.odometer')}: {current.odometer?.toFixed(1) ?? '—'} km
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>

            {/* player controls */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={pbPoints.length - 1}
                value={pbIndex}
                onChange={(e) => { setPlaying(false); setPbIndex(Number(e.target.value)); }}
                className="w-full"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {pbIndex + 1}/{pbPoints.length}
                {current?.gps_time ? ` · ${current.gps_time}` : ''}
                {current?.speed != null ? ` · ${current.speed.toFixed(1)} km/h` : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Alert History */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">{t('device.history')}</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
            </svg>
            <p className="text-gray-500 text-sm">{t('alerts.no_alerts')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700">{alert.alert_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{alert.message || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {alert.acknowledged_at ? '✓ Acknowledged' : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}