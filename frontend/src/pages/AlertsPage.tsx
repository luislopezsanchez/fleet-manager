import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import type { Alert, AlertSeverity, AlertListResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────
interface AlertStats {
  total: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  unacknowledged: number;
}

// ── Severity colours ───────────────────────────────────────────────────────
const severityColors: Record<AlertSeverity, { badge: string; border: string; card: string; text: string }> = {
  low: {
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-l-blue-400',
    card: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  medium: {
    badge: 'bg-yellow-100 text-yellow-700',
    border: 'border-l-yellow-400',
    card: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
  },
  high: {
    badge: 'bg-orange-100 text-orange-700',
    border: 'border-l-orange-400',
    card: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
  },
  critical: {
    badge: 'bg-red-100 text-red-700',
    border: 'border-l-red-400',
    card: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
  info: {
    badge: 'bg-gray-100 text-gray-700',
    border: 'border-l-gray-400',
    card: 'bg-gray-50 border-gray-200',
    text: 'text-gray-700',
  },
  warning: {
    badge: 'bg-yellow-100 text-yellow-700',
    border: 'border-l-yellow-400',
    card: 'bg-yellow-50 border-yellow-200',
    text: 'text-yellow-700',
  },
};

const SEVERITY_OPTIONS: string[] = ['', 'low', 'medium', 'high', 'critical'];
const TYPE_OPTIONS = ['', 'inactivity', 'overspeed', 'geofence', 'offline'];

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

// ── Component ──────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterUnackOnly, setFilterUnackOnly] = useState(false);

  // ── Fetch alerts ─────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    try {
      const params: Record<string, string | boolean> = {};
      if (filterSeverity) params.severity = filterSeverity;
      if (filterType) params.type = filterType;
      if (filterUnackOnly) params.acknowledged = false;

      const response = await api.get<AlertListResponse>('/alerts/', { params });
      setAlerts(response.data.alerts);
    } catch {
      // silently fail — next refresh will retry
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterType, filterUnackOnly]);

  // ── Fetch stats ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<AlertStats>('/alerts/stats');
      setStats(response.data);
    } catch {
      // silently fail
    }
  }, []);

  // ── Initial + filter-change load ─────────────────────────────────────────
  useEffect(() => {
    fetchAlerts();
    fetchStats();
  }, [fetchAlerts, fetchStats]);

  // ── Auto-refresh every 60 seconds ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts();
      fetchStats();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAlerts, fetchStats]);

  // ── Acknowledge ──────────────────────────────────────────────────────────
  const handleAcknowledge = async (id: number) => {
    try {
      await api.post(`/alerts/${id}/acknowledge`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a
        )
      );
      // Refresh stats after acknowledge
      fetchStats();
    } catch {
      // error handling
    }
  };

  // ── Manual check ─────────────────────────────────────────────────────────
  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await api.post('/alerts/check');
      await Promise.all([fetchAlerts(), fetchStats()]);
    } catch {
      // error handling
    } finally {
      setChecking(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ── Stats cards ──────────────────────────────────────────────────────────
  const severityKeys: AlertSeverity[] = ['high', 'medium', 'low', 'critical'];

  const statCard = (
    label: string,
    value: number,
    colorClasses: string
  ) => (
    <div className={`rounded-xl border p-4 ${colorClasses}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('alerts.title')}</h1>
        </div>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {t('alerts.check_now')}
        </button>
      </div>

      {/* ── Stats cards ───────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {statCard(t('alerts.stats_total'), stats.total, 'bg-white border-gray-200 text-gray-800')}
          {statCard(
            t('alerts.stats_unacknowledged'),
            stats.unacknowledged,
            stats.unacknowledged > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-green-50 border-green-200 text-green-700'
          )}
          {severityKeys.map((sev) => {
            const colors = severityColors[sev];
            const count = stats.by_severity[sev] || 0;
            const label = t(`alerts.severity_${sev}`, { defaultValue: sev });
            return (
              <div key={sev} className={`rounded-xl border p-4 ${colors.card}`}>
                <p className={`text-sm font-medium ${colors.text}`}>{label}</p>
                <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t('alerts.filter_severity')}</label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SEVERITY_OPTIONS.map((sev) => (
              <option key={sev} value={sev}>
                {sev ? t(`alerts.severity_${sev}`, { defaultValue: sev }) : '—'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t('alerts.filter_type')}</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TYPE_OPTIONS.map((typ) => (
              <option key={typ} value={typ}>
                {typ ? t(`alerts.type_${typ}`, { defaultValue: typ }) : '—'}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnackOnly}
            onChange={(e) => setFilterUnackOnly(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('alerts.unacknowledged_only')}
        </label>
      </div>

      {/* ── Alerts table ──────────────────────────────────────────────────── */}
      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
          </svg>
          <p className="text-gray-500 text-sm">{t('alerts.no_alerts')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('devices.imei')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('alerts.filter_type')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('alerts.filter_severity')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('alerts.message', { defaultValue: 'Mensaje' })}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('devices.last_seen', { defaultValue: 'Fecha' })}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('devices.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.map((alert) => {
                  const colors = severityColors[alert.severity] || severityColors.medium;
                  const isAck = !!alert.acknowledged_at;
                  return (
                    <tr key={alert.id} className={`hover:bg-gray-50 ${isAck ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono whitespace-nowrap">
                        {alert.device_imei}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {t(`alerts.type_${alert.alert_type}`, { defaultValue: alert.alert_type })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          {t(`alerts.severity_${alert.severity}`, { defaultValue: alert.severity })}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                        {alert.message}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(alert.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isAck ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('alerts.acknowledged', { defaultValue: 'Atendida' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {t('alerts.pending', { defaultValue: 'Pendiente' })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {!isAck && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            {t('alerts.acknowledge')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );}
