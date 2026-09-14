import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import type { DeviceListResponse, TrackResponse, GpsPosition, Device } from '../types';

// Fix default icon issue with webpack/vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Colored marker icons
const makeIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const iconMoving = makeIcon('#22c55e');
const iconStationary = makeIcon('#eab308');
const iconAccOn = makeIcon('#3b82f6');

const ORG_ID = 6128;

function getMarkerIcon(pos: GpsPosition): L.DivIcon {
  if (pos.speed && pos.speed > 0) return iconMoving;
  if (pos.acc_on) return iconAccOn;
  return iconStationary;
}

// Component to fit map bounds to all markers
function FitBounds({ positions }: { positions: GpsPosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, positions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mapRef = useRef<L.Map | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, trackRes] = await Promise.all([
        api.get<DeviceListResponse>('/devices/'),
        api.post<TrackResponse>('/devices/track', { org_id: ORG_ID }),
      ]);
      setDevices(devRes.data.devices);
      setPositions(trackRes.data.positions);
      setError('');
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate KPIs
  const deviceMap = new Map(devices.map((d) => [d.imei, d]));
  const total = devices.length;
  let moving = 0;
  let stationary = 0;
  let offline = 0;
  let overspeeding = 0;

  for (const dev of devices) {
    const pos = positions.find((p) => p.device_imei === dev.imei);
    if (!pos) {
      offline++;
      continue;
    }
    if (pos.speed && pos.speed > 0) {
      moving++;
      const overSpeedLimit = dev.over_speed || 80;
      if (pos.speed > overSpeedLimit) overspeeding++;
    } else {
      stationary++;
    }
  }

  const kpis = [
    { key: 'total_devices', value: total, color: 'text-blue-500', bg: 'bg-blue-50', icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z' },
    { key: 'moving', value: moving, color: 'text-green-500', bg: 'bg-green-50', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { key: 'stationary', value: stationary, color: 'text-yellow-500', bg: 'bg-yellow-50', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'offline', value: offline, color: 'text-gray-500', bg: 'bg-gray-50', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
    { key: 'overspeeding', value: overspeeding, color: 'text-red-500', bg: 'bg-red-50', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
        <p className="text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 ${kpi.bg} rounded-lg flex items-center justify-center`}>
                <svg className={`w-6 h-6 ${kpi.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.icon} />
                </svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-800">{kpi.value}</div>
            <div className="text-sm text-gray-500 mt-1">{t(`dashboard.${kpi.key}`)}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">{t('map.title')}</h2>
        <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200">
          {positions.length > 0 ? (
            <MapContainer
              center={[positions[0].lat, positions[0].lon]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              ref={(m) => { if (m) mapRef.current = m; }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
                maxZoom={19}
              />
              <FitBounds positions={positions} />
              {positions.map((pos) => {
                const dev = deviceMap.get(pos.device_imei);
                return (
                  <Marker
                    key={pos.device_imei}
                    position={[pos.lat, pos.lon]}
                    icon={getMarkerIcon(pos)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{dev?.device_name || pos.device_imei}</strong><br />
                        IMEI: {pos.device_imei}<br />
                        {t('devices.plate')}: {dev?.plate_no || '—'}<br />
                        {t('dashboard.moving')}: {pos.speed?.toFixed(1) || 0} km/h<br />
                        {t('devices.last_seen')}: {pos.gps_time || '—'}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <p className="text-gray-400 text-sm">No positions available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}