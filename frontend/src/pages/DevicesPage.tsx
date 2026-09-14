import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { DeviceListResponse, Device, GpsPosition, TrackResponse, DeviceStatus, Sector } from '../types';

const ORG_ID = 6128;

const statusColors: Record<string, string> = {
  moving: 'bg-blue-100 text-blue-700',
  stationary: 'bg-yellow-100 text-yellow-700',
  offline: 'bg-gray-100 text-gray-600',
  overspeed: 'bg-red-100 text-red-700',
  acc_on: 'bg-purple-100 text-purple-700',
  online: 'bg-green-100 text-green-700',
  expired: 'bg-orange-100 text-orange-700',
  inactive: 'bg-gray-100 text-gray-500',
};

function calculateStatus(
  dev: Device,
  pos: GpsPosition | undefined,
  hasPosition: boolean
): DeviceStatus {
  if (!hasPosition || !pos) return 'offline';
  if (pos.speed && pos.speed > 0) {
    const limit = dev.over_speed || 80;
    if (pos.speed > limit) return 'overspeed';
    return 'moving';
  }
  if (pos.acc_on) return 'acc_on';
  return 'stationary';
}

export default function DevicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<Map<string, GpsPosition>>(new Map());
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [sectorFilter, setSectorFilter] = useState<number | ''>('');
  const [updatingImei, setUpdatingImei] = useState<string | null>(null);

  const fetchSectors = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get<Sector[]>('/sectors/');
      setSectors(res.data);
    } catch {
      // Silently fail — sectors are optional for display
    }
  }, [isAdmin]);

  const fetchDevices = useCallback(async () => {
    try {
      const params: Record<string, string | number> = {};
      if (sectorFilter !== '') {
        params.sector_id = sectorFilter;
      }
      const [devRes, trackRes] = await Promise.all([
        api.get<DeviceListResponse>('/devices/', { params }),
        api.post<TrackResponse>('/devices/track', { org_id: ORG_ID }).catch(() => null),
      ]);
      setDevices(devRes.data.devices);
      if (trackRes) {
        const map = new Map<string, GpsPosition>();
        for (const p of trackRes.data.positions) {
          map.set(p.device_imei, p);
        }
        setPositions(map);
      }
      setError('');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, sectorFilter]);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      await api.post('/devices/sync', null, { params: { org_id: ORG_ID } });
      await fetchDevices();
    } catch {
      setError(t('common.error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleSectorChange = async (imei: string, sectorId: number | null) => {
    setUpdatingImei(imei);
    try {
      await api.put(`/devices/${imei}/sector`, { sector_id: sectorId });
      // Update local state
      setDevices((prev) =>
        prev.map((d) => (d.imei === imei ? { ...d, sector_id: sectorId } : d))
      );
    } catch {
      setError(t('common.error'));
    } finally {
      setUpdatingImei(null);
    }
  };

  const getSectorName = (sectorId: number | null) => {
    if (sectorId === null || sectorId === undefined) return null;
    const sector = sectors.find((s) => s.id === sectorId);
    return sector?.name ?? null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('devices.title')}</h1>
          <p className="text-gray-500 mt-1">{t('devices.subtitle')}</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          {syncing ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('common.loading')}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('devices.sync')}
            </>
          )}
        </button>
      </div>

      {/* Sector filter (admin only) */}
      {isAdmin && sectors.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">{t('devices.sector')}:</label>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value === '' ? '' : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.search')} —</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {devices.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-gray-500 text-sm">{t('devices.sync')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.name')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.driver')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">IMEI</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.plate')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.sector')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.last_seen')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('devices.status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {devices.map((device) => {
                  const pos = positions.get(device.imei);
                  const hasPos = !!pos;
                  const status = calculateStatus(device, pos, hasPos);
                  return (
                    <tr
                      key={device.id}
                      onClick={() => navigate(`/devices/${device.imei}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">{device.device_name || device.imei}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{device.driver_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{device.imei}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{device.plate_no || '—'}</td>
                      <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                        {isAdmin ? (
                          <select
                            value={device.sector_id ?? ''}
                            disabled={updatingImei === device.imei}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : Number(e.target.value);
                              handleSectorChange(device.imei, val);
                            }}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 min-w-[120px]"
                          >
                            <option value="">{t('devices.no_sector')}</option>
                            {sectors.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-600">{getSectorName(device.sector_id) || t('devices.no_sector')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {device.last_online_time ? new Date(device.last_online_time).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || statusColors.offline}`}>
                          {t(`status.${status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}