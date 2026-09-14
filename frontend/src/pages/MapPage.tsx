import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import DevicePopup from '../components/DevicePopup';
import type { DeviceListResponse, TrackResponse, GpsPosition, Device, Sector } from '../types';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;

const makeIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const icons: Record<string, L.DivIcon> = {
  moving: makeIcon('#22c55e'),
  stationary: makeIcon('#eab308'),
  offline: makeIcon('#ef4444'),
  acc_on: makeIcon('#3b82f6'),
  overspeed: makeIcon('#ef4444'),
  default: makeIcon('#6b7280'),
};

const ORG_ID = 6128;

function getIcon(pos: GpsPosition | undefined, overSpeedLimit: number | null): L.DivIcon {
  if (!pos) return icons.offline;
  const speed = pos.speed ?? 0;
  if (overSpeedLimit != null && speed > overSpeedLimit) return icons.overspeed;
  if (speed > 0) return icons.moving;
  if (pos.acc_on) return icons.acc_on;
  return icons.stationary;
}

function FitBounds({ positions }: { positions: GpsPosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map((p) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, positions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, trackRes] = await Promise.all([
        api.get<DeviceListResponse>('/devices/'),
        api.post<TrackResponse>('/devices/track', { org_id: ORG_ID }),
      ]);
      setDevices(devRes.data.devices);
      setPositions(trackRes.data.positions);
    } catch {
      // silent retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    api.get<Sector[]>('/sectors/').then((res) => setSectors(res.data)).catch(() => {});
  }, []);

  const posMap = new Map(positions.map((p) => [p.device_imei, p]));

  // Filter devices by sector
  const filteredDevices = selectedSector === 'all'
    ? devices
    : devices.filter((d) => d.sector_id === Number(selectedSector));

  const allMarkers = filteredDevices.map((dev) => ({
    device: dev,
    position: posMap.get(dev.imei),
  })).filter((m) => m.position);

  const positionsToShow = allMarkers.map((m) => m.position!);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with sector filter */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{t('map.title')}</h1>
          <p className="text-sm text-gray-500">{t('map.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Sector:</label>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All</option>
            {sectors.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ minHeight: '500px' }}>
        <MapContainer
          center={[-34.9011, -56.1645]} // Montevideo default
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            maxZoom={19}
          />
          <FitBounds positions={positionsToShow} />
          {allMarkers.map(({ device, position }) => (
            <Marker
              key={device.imei}
              position={[position!.lat, position!.lon]}
              icon={getIcon(position, device.over_speed ?? null)}
            >
              <Popup>
                <DevicePopup device={device} pos={position!} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-600">{t('dashboard.moving')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-xs text-gray-600">{t('dashboard.stationary')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-xs text-gray-600">{t('status.overspeed')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-gray-600">{t('status.acc_on')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gray-500"></div>
          <span className="text-xs text-gray-600">{t('dashboard.offline')}</span>
        </div>
      </div>
    </div>
  );
}