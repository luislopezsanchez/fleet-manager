import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { DeviceListResponse, Device, GpsPosition, TrackResponse, DeviceStatus, Sector, VehicleCreatePayload } from '../types';

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

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

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
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const emptyForm: VehicleCreatePayload = {
    imei: '', device_name: '', driver_name: '', plate_no: '',
    sector_id: null, over_speed: undefined, sim: '', car_vin: '',
  };
  const [form, setForm] = useState<VehicleCreatePayload>(emptyForm);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!form.imei || form.imei.length < 10) {
      setAddError(t('vehicles.imei') + ': min 10');
      return;
    }
    setSaving(true);
    try {
      const payload: VehicleCreatePayload = { ...form };
      await api.post('/devices/', payload);
      setShowAdd(false);
      setForm(emptyForm);
      await fetchDevices();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      setAddError(typeof detail === 'string' && detail.includes('already exists') ? t('vehicles.exists') : t('common.error'));
    } finally {
      setSaving(false);
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
          <h1 className="text-2xl font-bold text-gray-800">{t('vehicles.title')}</h1>
          <p className="text-gray-500 mt-1">{t('vehicles.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('vehicles.add')}
            </button>
          )}
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('vehicles.name')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('vehicles.driver')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">IMEI</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('vehicles.plate')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('vehicles.sector')}</th>
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

      {/* Add vehicle modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-800 mb-4">{t('vehicles.add')}</h2>
            {addError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{addError}</div>
            )}
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">IMEI *</label>
                <input
                  className={inputCls}
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value.trim() })}
                  placeholder="8652350596..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.name')}</label>
                  <input className={inputCls} value={form.device_name || ''} onChange={(e) => setForm({ ...form, device_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.driver')}</label>
                  <input className={inputCls} value={form.driver_name || ''} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.plate')}</label>
                  <input className={inputCls} value={form.plate_no || ''} onChange={(e) => setForm({ ...form, plate_no: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.over_speed')}</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.over_speed ?? ''}
                    onChange={(e) => setForm({ ...form, over_speed: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.sim')}</label>
                  <input className={inputCls} value={form.sim || ''} onChange={(e) => setForm({ ...form, sim: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.vin')}</label>
                  <input className={inputCls} value={form.car_vin || ''} onChange={(e) => setForm({ ...form, car_vin: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('vehicles.sector')}</label>
                <select
                  className={inputCls}
                  value={form.sector_id ?? ''}
                  onChange={(e) => setForm({ ...form, sector_id: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <option value="">{t('devices.no_sector')}</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  {saving ? t('common.loading') : t('vehicles.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}