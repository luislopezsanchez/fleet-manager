import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { DeviceListResponse, Device } from '../types';

type ReportType = 'mileage' | 'alarms' | 'overspeed' | 'history' | 'geofences' | 'drivers';

function toIsoStart(dateStr: string): string {
  if (!dateStr) return '';
  return `${dateStr}T00:00:00Z`;
}

function toIsoEnd(dateStr: string): string {
  if (!dateStr) return '';
  return `${dateStr}T23:59:59Z`;
}

function flattenData(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'list', 'rows', 'items', 'results', 'eventos_geocerca']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
    return [obj];
  }
  return [];
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    ),
  ];
  const csv = csvLines.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('mileage');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasResults, setHasResults] = useState(false);

  // driver assignment management
  const [showDrivers, setShowDrivers] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [drvForm, setDrvForm] = useState({ device_imei: '', driver_name: '', driver_doc: '', start_time: '', end_time: '', notes: '' });
  const [drvError, setDrvError] = useState('');
  const [drvSaving, setDrvSaving] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get<DeviceListResponse>('/devices/');
      setDevices(res.data.devices);
    } catch {
      // silent
    } finally {
      setDevicesLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const deviceIdMap = devices.map((d) => ({ vid: d.id, imei: d.imei, name: d.device_name || d.imei }));

  // ── Report catalog: card per type ──
  const needsDevice = (rt: ReportType) => rt !== 'geofences';
  const reportCards: {
    value: ReportType; icon: string; descKey: string;
    scope: 'vehicle' | 'fleet';
  }[] = [
    { value: 'mileage', icon: '🛣️', descKey: 'reports.desc_mileage', scope: 'vehicle' },
    { value: 'overspeed', icon: '⚠️', descKey: 'reports.desc_overspeed', scope: 'vehicle' },
    { value: 'alarms', icon: '🔔', descKey: 'reports.desc_alarms', scope: 'vehicle' },
    { value: 'history', icon: '🗺️', descKey: 'reports.desc_history', scope: 'vehicle' },
    { value: 'geofences', icon: '⭐', descKey: 'reports.desc_geofences', scope: 'fleet' },
    { value: 'drivers', icon: '👤', descKey: 'reports.desc_drivers', scope: 'vehicle' },
  ];

  const loadAssignments = async () => {
    try {
      const res = await api.get('/drivers/assignments');
      setAssignments(res.data);
    } catch { /* silent */ }
  };

  const openDrivers = () => {
    setShowDrivers(true);
    setDrvError('');
    loadAssignments();
  };

  const saveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDrvError('');
    if (!drvForm.device_imei || !drvForm.driver_name || !drvForm.start_time) {
      setDrvError(t('reports.drv_required'));
      return;
    }
    setDrvSaving(true);
    try {
      await api.post('/drivers/assignments', {
        device_imei: drvForm.device_imei,
        driver_name: drvForm.driver_name,
        driver_doc: drvForm.driver_doc || null,
        start_time: new Date(drvForm.start_time).toISOString().replace(/\.\d+/, ''),
        end_time: drvForm.end_time ? new Date(drvForm.end_time).toISOString().replace(/\.\d+/, '') : null,
        notes: drvForm.notes || null,
      });
      setDrvForm({ device_imei: '', driver_name: '', driver_doc: '', start_time: '', end_time: '', notes: '' });
      await loadAssignments();
    } catch (err: any) {
      setDrvError(err?.response?.data?.detail || t('common.error'));
    } finally {
      setDrvSaving(false);
    }
  };

  const deleteAssignment = async (id: number) => {
    try {
      await api.delete(`/drivers/assignments/${id}`);
      await loadAssignments();
    } catch { /* silent */ }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError(t('reports.err_dates'));
      return;
    }
    if (needsDevice(reportType) && !selectedDevice) {
      setError(t('reports.err_device'));
      return;
    }
    setLoading(true);
    setError('');
    setHasResults(false);
    setResults([]);
    try {
      const start = toIsoStart(startDate);
      const end = toIsoEnd(endDate);
      const devMap = deviceIdMap.find((d) => d.imei === selectedDevice);
      let data: unknown;

      switch (reportType) {
        case 'mileage':
          data = await api.get('/reports/mileage', { params: { vid: devMap?.vid, start_time: start, end_time: end } });
          break;
        case 'alarms':
          data = await api.get('/reports/alarms', { params: { vid: devMap?.vid, start_time: start, end_time: end, warn_ids: '1025,1026' } });
          break;
        case 'overspeed':
          data = await api.get('/reports/overspeed', { params: { vid: devMap?.vid, start_time: start, end_time: end } });
          break;
        case 'history':
          data = await api.get('/reports/history', { params: { imei: selectedDevice, start_time: start, end_time: end } });
          break;
        case 'geofences':
          data = await api.get('/reports/geofences', {
            params: selectedDevice ? { start_time: start, end_time: end, device_imei: selectedDevice } : { start_time: start, end_time: end },
          });
          break;
        case 'drivers':
          data = await api.get('/reports/drivers', { params: { start_time: start, end_time: end, device_imei: selectedDevice } });
          break;
        default:
          return;
      }

      const respData = (data as any).data;

      if (respData && typeof respData === 'object' && respData.code === 1) {
        setError(respData.msg || respData.message || t('reports.err_query'));
        setResults([]);
        setHasResults(true);
        return;
      }
      if (typeof respData === 'string' && respData.includes('Please select')) {
        setError(respData);
        setResults([]);
        setHasResults(true);
        return;
      }

      const rows = flattenData(respData);
      setResults(rows);
      setHasResults(true);
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData && typeof errData === 'object' && errData.code === 1) {
        setError(errData.msg || errData.message || t('reports.err_query'));
      } else {
        setError(err?.response?.data?.detail || t('common.error'));
      }
      setResults([]);
      setHasResults(true);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const devName = deviceIdMap.find((d) => d.imei === selectedDevice)?.name || 'flota';
    exportCsv(results, `${reportType}_${devName}_${startDate}_${endDate}.csv`);
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('reports.title')}</h1>
        <p className="text-gray-500 mt-1">{t('reports.subtitle')}</p>
      </div>

      {/* Report catalog cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {reportCards.map((card) => {
          const selected = reportType === card.value;
          return (
            <button
              key={card.value}
              onClick={() => { setReportType(card.value); setHasResults(false); setResults([]); setError(''); }}
              className={`text-left rounded-xl border p-4 transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{card.icon}</span>
                <span className={`font-semibold ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                  {t(`reports.${card.value === 'geofences' ? 'geofences' : card.value === 'drivers' ? 'drivers' : card.value}`)}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-snug">{t(card.descKey)}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  card.scope === 'fleet' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {card.scope === 'fleet' ? t('reports.scope_fleet') : t('reports.scope_vehicle')}
                </span>
                <span className="text-[10px] text-gray-400">{t(`reports.src_${card.value}`)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Parameters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {needsDevice(reportType) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.device')}</label>
              <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className={inputCls}>
                <option value="">— {t('reports.select')} —</option>
                {deviceIdMap.map((d) => (
                  <option key={d.imei} value={d.imei}>{d.name} ({d.imei})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.start_date')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.end_date')}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">
            <span className="text-xs text-gray-400">{t('reports.max_range')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t('reports.generate')}
          </button>
          {isAdmin && reportType === 'drivers' && (
            <button onClick={openDrivers} className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm">
              👤 {t('reports.manage_drivers')}
            </button>
          )}
          {hasResults && results.length > 0 && (
            <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('reports.export')}
            </button>
          )}
        </div>
      </div>

      {reportType === 'drivers' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
          <span className="font-semibold">ℹ️</span>
          <div>
            {t('reports.drv_step1')} <b>{t('reports.manage_drivers')}</b> — {t('reports.drv_step2')}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {/* Results table */}
      {hasResults && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">{t('reports.no_data')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                {results.length} {t('reports.rows')}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {Object.keys(results[0]).map((key) => (
                      <th key={key} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {Object.keys(results[0]).map((key) => (
                        <td key={key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {row[key] === null || row[key] === undefined
                            ? '—'
                            : typeof row[key] === 'object'
                              ? JSON.stringify(row[key])
                              : String(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!hasResults && !loading && devicesLoaded && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-sm">{t('reports.hint')}</p>
        </div>
      )}

      {/* Driver assignments management modal */}
      {showDrivers && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDrivers(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-1">{t('reports.manage_drivers')}</h2>
            <p className="text-xs text-gray-400 mb-4">{t('reports.drv_hint')}</p>

            <form onSubmit={saveAssignment} className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.device')}</label>
                <select value={drvForm.device_imei} onChange={(e) => setDrvForm({ ...drvForm, device_imei: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {devices.map((d) => (
                    <option key={d.imei} value={d.imei}>{d.device_name || d.imei}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.drv_name')}</label>
                <input value={drvForm.driver_name} onChange={(e) => setDrvForm({ ...drvForm, driver_name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.drv_doc')}</label>
                <input value={drvForm.driver_doc} onChange={(e) => setDrvForm({ ...drvForm, driver_doc: e.target.value })} className={inputCls} />
                </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.start_date')}</label>
                  <input type="datetime-local" value={drvForm.start_time} onChange={(e) => setDrvForm({ ...drvForm, start_time: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.end_date')}</label>
                  <input type="datetime-local" value={drvForm.end_time} onChange={(e) => setDrvForm({ ...drvForm, end_time: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('reports.drv_notes')}</label>
                <input value={drvForm.notes} onChange={(e) => setDrvForm({ ...drvForm, notes: e.target.value })} className={inputCls} />
              </div>
              {drvError && <div className="col-span-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">{drvError}</div>}
              <div className="col-span-2 flex justify-end">
                <button type="submit" disabled={drvSaving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg text-sm">
                  {drvSaving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase">{t('reports.drv_name')}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase">{t('reports.device')}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase">{t('reports.start_date')}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase">{t('reports.end_date')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-sm">{a.driver_name} <span className="text-gray-400 text-xs">{a.driver_doc || ''}</span></td>
                    <td className="px-3 py-2 text-sm">{devices.find((d) => d.imei === a.device_imei)?.device_name || a.device_imei}</td>
                    <td className="px-3 py-2 text-sm">{new Date(a.start_time).toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm">{a.end_time ? new Date(a.end_time).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteAssignment(a.id)} className="p-1 rounded hover:bg-red-50 text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-sm text-gray-400 text-center">{t('reports.drv_empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}