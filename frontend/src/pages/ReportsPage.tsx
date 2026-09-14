import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import type { DeviceListResponse, Device } from '../types';

type ReportType = 'mileage' | 'alarms' | 'overspeed' | 'history';

interface DeviceIdMap {
  vid: number;
  imei: string;
  name: string;
}

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
    // Try common keys
    for (const key of ['data', 'list', 'rows', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
    // If it's a single object, wrap it
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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { t } = useTranslation();
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

  // Device IMEI → vid mapping (use device.id as vid fallback)
  const deviceIdMap: DeviceIdMap[] = devices.map((d) => ({
    vid: d.id,
    imei: d.imei,
    name: d.device_name || d.imei,
  }));

  const handleGenerate = async () => {
    if (!startDate || !endDate || !selectedDevice) {
      setError('Please select device and date range');
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
          data = await api.get('/reports/mileage', {
            params: { vid: devMap?.vid, start_time: start, end_time: end },
          });
          break;
        case 'alarms':
          data = await api.get('/reports/alarms', {
            params: { vid: devMap?.vid, start_time: start, end_time: end, warn_ids: '1025,1026' },
          });
          break;
        case 'overspeed':
          data = await api.get('/reports/overspeed', {
            params: { vid: devMap?.vid, start_time: start, end_time: end },
          });
          break;
        case 'history':
          data = await api.get('/reports/history', {
            params: { imei: selectedDevice, start_time: start, end_time: end },
          });
          break;
        default:
          return;
      }

      const respData = (data as any).data;

      // Check if istarmap returned an error (code=1 with a msg)
      if (respData && typeof respData === 'object' && respData.code === 1) {
        const errMsg = respData.msg || respData.message || 'Error en la consulta del reporte';
        setError(errMsg);
        setResults([]);
        setHasResults(true);
        return;
      }

      // Also check for string-type error responses
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
      // Check if the error response contains istarmap error data
      const errData = err?.response?.data;
      if (errData && typeof errData === 'object' && errData.code === 1) {
        setError(errData.msg || errData.message || 'Error en la consulta del reporte');
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
    const devName = deviceIdMap.find((d) => d.imei === selectedDevice)?.name || 'report';
    exportCsv(results, `${reportType}_${devName}_${startDate}_${endDate}.csv`);
  };

  const reportTypes: { value: ReportType; label: string }[] = [
    { value: 'mileage', label: t('reports.mileage') },
    { value: 'alarms', label: t('reports.alarms') },
    { value: 'overspeed', label: t('reports.overspeed') },
    { value: 'history', label: t('reports.history') },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('reports.title')}</h1>
        <p className="text-gray-500 mt-1">{t('reports.subtitle')}</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Report type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.type')}</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {reportTypes.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>

          {/* Device */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.device')}</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">— Select —</option>
              {deviceIdMap.map((d) => (
                <option key={d.imei} value={d.imei}>{d.name} ({d.imei})</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.start_date')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('reports.end_date')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {t('reports.generate')}
          </button>
          {hasResults && results.length > 0 && (
            <button
              onClick={handleExport}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t('reports.export')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Results table */}
      {hasResults && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">Sin datos disponibles para este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
          <p className="text-gray-500 text-sm">Select parameters and generate a report</p>
        </div>
      )}
    </div>
  );
}