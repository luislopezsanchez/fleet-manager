import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MapContainer, TileLayer, Circle, Polygon, Marker, useMap, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { Geofence, GeofenceEvent } from '../types';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl;

// ── Map click collector ────────────────────────────────────────────────────
function ClickCollector({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitAll({ fences }: { fences: Geofence[] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [];
    for (const f of fences) {
      if (f.shape === 'circle' && f.center_lat != null) pts.push([f.center_lat, f.center_lon!]);
      if (f.shape === 'polygon' && f.polygon) pts.push(...(f.polygon as [number, number][]));
    }
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
  }, [map, fences.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

const pinIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width:12px;height:12px;border-radius:50%;background:#1d4ed8;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

type DrawMode = 'none' | 'circle' | 'polygon';

export default function GeofencesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [fences, setFences] = useState<Geofence[]>([]);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [draft, setDraft] = useState<{
    shape: 'circle' | 'polygon';
    center?: { lat: number; lon: number };
    radius_m?: number;
    points?: [number, number][];
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [alertOn, setAlertOn] = useState<'entry' | 'exit' | 'both'>('both');
  const [color, setColor] = useState('#3b82f6');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const radiusInputRef = useRef<number>(300);

  const fetchData = useCallback(async () => {
    try {
      const [fRes, eRes] = await Promise.all([
        api.get<Geofence[]>('/geofences/', { params: { include_inactive: true } }),
        api.get<GeofenceEvent[]>('/geofences/events', { params: { limit: 50 } }),
      ]);
      setFences(fRes.data);
      setEvents(eRes.data);
      setError('');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // refresh events periodically
  useEffect(() => {
    const interval = setInterval(() => {
      api.get<GeofenceEvent[]>('/geofences/events', { params: { limit: 50 } })
        .then((r) => setEvents(r.data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const onMapClick = (lat: number, lon: number) => {
    if (!isAdmin || drawMode === 'none' || showForm) return;
    if (drawMode === 'circle') {
      setDraft({ shape: 'circle', center: { lat, lon }, radius_m: radiusInputRef.current });
      setShowForm(true);
    } else if (drawMode === 'polygon') {
      setDraft((d) => {
        const points = [...(d?.points || []), [lat, lon] as [number, number]];
        return { shape: 'polygon', points };
      });
    }
  };

  const onRadiusChange = (r: number) => {
    radiusInputRef.current = r;
    setDraft((d) => (d ? { ...d, radius_m: r } : d));
  };

  const saveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setFormError('');
    if (!name.trim()) {
      setFormError(t('geofences.name_required'));
      return;
    }
    if (draft.shape === 'polygon' && (!draft.points || draft.points.length < 3)) {
      setFormError(t('geofences.need_points'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/geofences/', {
        name: name.trim(),
        description: description || null,
        shape: draft.shape,
        center_lat: draft.shape === 'circle' ? draft.center!.lat : null,
        center_lon: draft.shape === 'circle' ? draft.center!.lon : null,
        radius_m: draft.shape === 'circle' ? draft.radius_m : null,
        polygon: draft.shape === 'polygon' ? draft.points : null,
        color,
        alert_on: alertOn,
        is_active: true,
      });
      setShowForm(false);
      setDraft(null);
      setDrawMode('none');
      setName('');
      setDescription('');
      setNotice(t('geofences.created'));
      setTimeout(() => setNotice(''), 3000);
      await fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (f: Geofence) => {
    try {
      await api.put(`/geofences/${f.id}`, { is_active: !f.is_active });
      await fetchData();
    } catch {
      setError(t('common.error'));
    }
  };

  const removeFence = async (f: Geofence) => {
    if (!window.confirm(t('geofences.delete_confirm', { name: f.name }))) return;
    try {
      await api.delete(`/geofences/${f.id}`);
      setNotice(t('geofences.deleted'));
      setTimeout(() => setNotice(''), 3000);
      await fetchData();
    } catch {
      setError(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{t('geofences.title')}</h1>
          <p className="text-sm text-gray-500">{t('geofences.subtitle')}</p>
        </div>
        {isAdmin && !showForm && (
          <div className="flex items-center gap-2">
            <select
              value={drawMode}
              onChange={(e) => {
                setDrawMode(e.target.value as DrawMode);
                setDraft(null);
                setShowForm(false);
              }}
              className={`border rounded-lg px-3 py-2 text-sm outline-none ${
                drawMode !== 'none'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <option value="none">✏️ {t('geofences.draw_none')}</option>
              <option value="circle">⭕ {t('geofences.draw_circle')}</option>
              <option value="polygon">⬡ {t('geofences.draw_polygon')}</option>
            </select>
          </div>
        )}
      </div>

      {drawMode !== 'none' && !showForm && (
        <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {drawMode === 'circle'
            ? t('geofences.hint_circle')
            : t('geofences.hint_polygon')}
          {drawMode === 'circle' && (
            <span className="ml-3 inline-flex items-center gap-2">
              {t('geofences.radius')}: <input type="number" defaultValue={radiusInputRef.current} min={50}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                className="w-24 border border-blue-300 rounded px-2 py-0.5 text-sm" /> m
            </span>
          )}
          {drawMode === 'polygon' && draft?.points && draft.points.length > 0 && (
            <button
              onClick={() => setShowForm(true)}
              disabled={draft.points.length < 3}
              className="ml-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-3 py-1 rounded-lg text-xs"
            >
              {t('geofences.finish_polygon')} ({draft.points.length})
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-3">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1" style={{ minHeight: '500px' }}>
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <MapContainer
            center={[-34.9011, -56.1645]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              maxZoom={19}
            />
            <ClickCollector onMapClick={onMapClick} />
            <FitAll fences={fences} />

            {fences.map((f) => (
              <div key={f.id}>
                {f.shape === 'circle' && f.center_lat != null && (
                  <Circle
                    center={[f.center_lat, f.center_lon!]}
                    radius={f.radius_m!}
                    pathOptions={{ color: f.color, fillColor: f.color, fillOpacity: 0.12, weight: 2 }}
                  />
                )}
                {f.shape === 'polygon' && f.polygon && (
                  <Polygon
                    positions={f.polygon as [number, number][]}
                    pathOptions={{ color: f.color, fillColor: f.color, fillOpacity: 0.12, weight: 2 }}
                  />
                )}
              </div>
            ))}

            {/* draft drawing */}
            {draft?.shape === 'circle' && draft.center && (
              <>
                <Circle
                  center={[draft.center.lat, draft.center.lon]}
                  radius={draft.radius_m || 300}
                  pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.15, weight: 2, dashArray: '6' }}
                />
                <Marker position={[draft.center.lat, draft.center.lon]} icon={pinIcon} />
              </>
            )}
            {draft?.shape === 'polygon' && draft.points && draft.points.length > 0 && (
              <>
                <Polygon
                  positions={draft.points}
                  pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 0.15, weight: 2, dashArray: '6' }}
                />
                {draft.points.map((p, i) => (
                  <Marker key={i} position={p} icon={pinIcon} />
                ))}
              </>
            )}
          </MapContainer>
        </div>

        {/* Fence list */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {t('geofences.list_title')} ({fences.length})
            </h2>
            {fences.length === 0 ? (
              <p className="text-sm text-gray-400">{t('geofences.empty')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {fences.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: f.color }} />
                        <span className={`text-sm font-medium truncate ${f.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {f.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {f.shape === 'circle' ? `⭕ ${Math.round(f.radius_m!)} m` : `⬡ ${(f.polygon || []).length} pts`}
                        {' · '}
                        {t(`geofences.alert_${f.alert_on}`)}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleActive(f)}
                          className={`px-2 py-1 rounded text-xs font-medium ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {f.is_active ? 'ON' : 'OFF'}
                        </button>
                        <button
                          onClick={() => removeFence(f)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                          title={t('common.delete')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-1 overflow-hidden flex flex-col">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('geofences.events_title')}</h2>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">{t('geofences.no_events')}</p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between text-xs border border-gray-100 rounded-lg px-2.5 py-1.5">
                    <div className="min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded font-medium mr-1.5 ${
                        ev.event_type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {ev.event_type === 'entry' ? t('geofences.entry') : t('geofences.exit')}
                      </span>
                      <span className="text-gray-700 font-medium truncate">{ev.device_name || ev.device_imei}</span>
                      <span className="text-gray-400"> · {ev.geofence_name}</span>
                    </div>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create form: side panel (does not cover the map/draft) */}
      {showForm && draft && (
        <div className="fixed right-4 top-20 bottom-4 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-[1100] flex flex-col overflow-y-auto">
          <div className="p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{t('geofences.create_title')}</h2>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{formError}</div>
            )}
            <form onSubmit={saveDraft} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('geofences.name_label')}</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={t('geofences.name_placeholder')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('geofences.desc_label')}</label>
                <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {draft.shape === 'circle' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('geofences.radius')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={50} max={3000} step={50}
                      value={draft.radius_m || 300}
                      onChange={(e) => onRadiusChange(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-700 w-20 text-right">{draft.radius_m || 300} m</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('geofences.alert_on_label')}</label>
                <select className={inputCls} value={alertOn} onChange={(e) => setAlertOn(e.target.value as any)}>
                  <option value="both">{t('geofences.alert_both')}</option>
                  <option value="entry">{t('geofences.alert_entry_only')}</option>
                  <option value="exit">{t('geofences.alert_exit_only')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('geofences.color')}</label>
                <div className="flex gap-2">
                  {['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#ec4899'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-4 ${color === c ? 'border-gray-800' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setDraft(null); setDrawMode('none'); }} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg text-sm">
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}