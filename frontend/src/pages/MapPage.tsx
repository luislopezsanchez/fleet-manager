import { useEffect, useState, useCallback, useMemo } from 'react';
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

// Fly to a specific position when a vehicle is selected
function FocusOn({ pos, zoom }: { pos: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (pos) {
      map.flyTo(pos, zoom, { duration: 0.8 });
    }
  }, [pos?.[0], pos?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<GpsPosition[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // vehicle search
  const [search, setSearch] = useState('');
  const [selectedImei, setSelectedImei] = useState<string | null>(null);

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

  const fetchSectors = useCallback(async () => {
    try {
      const res = await api.get<Sector[]>('/sectors/');
      setSectors(res.data);
    } catch {
      // sectors optional
    }
  }, []);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  const posMap = new Map(positions.map((p) => [p.device_imei, p]));
  const sectorName = (id: number | null) => sectors.find((s) => s.id === id)?.name ?? null;

  // Filter devices by sector
  const filteredDevices = useMemo(
    () =>
      selectedSector === 'all'
        ? devices
        : devices.filter((d) => d.sector_id === Number(selectedSector)),
    [devices, selectedSector]
  );

  // Only devices WITH a current GPS fix get a marker (offline ones would
  // crash the map reading position.lat)
  const allMarkers = filteredDevices
    .map((dev) => ({ device: dev, position: posMap.get(dev.imei) }))
    .filter((m): m is { device: Device; position: GpsPosition } => !!m.position);
  const positionsToShow = allMarkers.map((m) => m.position);

  // search results (across the filtered set)
  const q = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return filteredDevices
      .filter(
        (d) =>
          (d.device_name || '').toLowerCase().includes(q) ||
          (d.driver_name || '').toLowerCase().includes(q) ||
          d.imei.toLowerCase().includes(q) ||
          (d.plate_no || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [q, filteredDevices]);

  const selected = selectedImei ? filteredDevices.find((d) => d.imei === selectedImei) : null;
  const selectedPos = selectedImei ? posMap.get(selectedImei) : null;

  const pickVehicle = (imei: string) => {
    setSelectedImei(imei);
    setSearch('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: search + sector filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{t('monitoring.title')}</h1>
          <p className="text-sm text-gray-500">{t('monitoring.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* vehicle search with dropdown */}
          <div className="relative w-64">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedImei(null);
              }}
              placeholder={t('vehicles.search_placeholder_short')}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                onClick={() => { setSearch(''); setSelectedImei(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {searchResults.map((d) => {
                  const p = posMap.get(d.imei);
                  return (
                    <button
                      key={d.imei}
                      onClick={() => pickVehicle(d.imei)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {d.device_name || d.imei}
                      </div>
                      <div className="text-xs text-gray-400">
                        {d.plate_no || '—'} · IMEI {d.imei}
                        {sectorName(d.sector_id) ? ` · ${sectorName(d.sector_id)}` : ''}
                        {p ? ` · ${(p.speed ?? 0).toFixed(0)} km/h` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {search && searchResults.length === 0 && (
              <div className="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                {t('vehicles.no_results')}
              </div>
            )}
          </div>

          {/* sector filter */}
          <select
            value={selectedSector}
            onChange={(e) => {
              setSelectedSector(e.target.value);
              setSelectedImei(null);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">{t('monitoring.all_sectors')}</option>
            {sectors.map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected vehicle banner */}
      {selected && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm">
            <span className="font-semibold text-gray-800">{selected.device_name || selected.imei}</span>
            <span className="text-gray-500 ml-2">
              {selectedPos ? `${(selectedPos.speed ?? 0).toFixed(1)} km/h · ${selectedPos.gps_time || ''}` : t('status.offline')}
            </span>
          </div>
          <button
            onClick={() => setSelectedImei(null)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {t('monitoring.clear_focus')}
          </button>
        </div>
      )}

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
          <FitBounds positions={selected ? (selectedPos ? [selectedPos] : []) : positionsToShow} />
          <FocusOn pos={selectedPos ? [selectedPos.lat, selectedPos.lon] : null} zoom={16} />
          {allMarkers.map(({ device, position }) => (
            <Marker
              key={device.imei}
              position={[position.lat, position.lon]}
              icon={getIcon(position, device.over_speed ?? null)}
              opacity={selected && device.imei !== selected.imei ? 0.35 : 1}
            >
              <Popup>
                <DevicePopup device={device} pos={position} />
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