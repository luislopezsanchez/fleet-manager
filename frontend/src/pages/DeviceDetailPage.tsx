import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import type { DeviceListResponse, Device, GpsPosition, AlertListResponse, Alert } from '../types';

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

function getMarkerIcon(pos: GpsPosition): L.DivIcon {
  if (pos.speed && pos.speed > 0) return iconMoving;
  if (pos.acc_on) return iconAccOn;
  return iconStationary;
}

export default function DeviceDetailPage() {
  const { imei } = useParams<{ imei: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDevice = useCallback(async () => {
    if (!imei) return;
    try {
      // Get all devices and find the one matching imei
      const devRes = await api.get<DeviceListResponse>('/devices/');
      const dev = devRes.data.devices.find((d) => d.imei === imei);
      if (!dev) {
        setError('Device not found');
        setDevice(null);
        return;
      }
      setDevice(dev);

      // Get position
      try {
        const posRes = await api.get<GpsPosition>(`/devices/${imei}/position`);
        setPosition(posRes.data);
      } catch {
        setPosition(null);
      }

      // Get alerts for this device
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
          {t('devices.title')}
        </button>
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
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
        {t('devices.title')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('device.info')}</h2>
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
              <label className="text-xs text-gray-500 uppercase">Over Speed Limit</label>
              <p className="text-sm text-gray-700">{device?.over_speed ?? '—'} km/h</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Fuel</label>
              <p className="text-sm text-gray-700">{device?.fuel_value ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Mini Map */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('map.title')}</h2>
          <div className="w-full h-80 rounded-lg overflow-hidden border border-gray-200">
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
                      Speed: {position.speed?.toFixed(1) || 0} km/h<br />
                      GPS Time: {position.gps_time || '—'}<br />
                      Odometer: {position.odometer?.toFixed(1) || 0} km
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
                <label className="text-xs text-gray-500">Speed</label>
                <p className="text-sm font-medium text-gray-800">{position.speed?.toFixed(1) || 0} km/h</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">Lat / Lon</label>
                <p className="text-sm font-medium text-gray-800">
                  {position.lat.toFixed(4)}, {position.lon.toFixed(4)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">Odometer</label>
                <p className="text-sm font-medium text-gray-800">{position.odometer?.toFixed(1) || 0} km</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="text-xs text-gray-500">Ignition</label>
                <p className="text-sm font-medium text-gray-800">
                  {position.acc_on ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>
          )}
        </div>
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
            <p className="text-gray-500 text-sm">No alerts for this device</p>
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