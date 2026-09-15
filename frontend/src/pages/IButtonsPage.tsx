import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { DeviceListResponse, Device } from '../types';

interface DriverRegistry {
  id: number;
  full_name: string;
  ibutton_id: string;
  device_imei: string | null;
  device_name: string | null;
  phone: string | null;
  document: string | null;
  card_type: string;
  expiry: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CommandLog {
  id: number;
  device_imei: string;
  command_type: number;
  ibutton_id: string | null;
  status: string;
  created_at: string;
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

export default function IButtonsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [drivers, setDrivers] = useState<DriverRegistry[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [commands, setCommands] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');

  // form modal (create/edit)
  const [showForm, setShowForm] = useState(false);
  const [editDriver, setEditDriver] = useState<DriverRegistry | null>(null);
  const [form, setForm] = useState({ full_name: '', ibutton_id: '', device_imei: '', phone: '', document: '', expiry: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [drvRes, devRes] = await Promise.all([
        api.get<DriverRegistry[]>('/ibuttons/drivers/', { params: { include_inactive: true } }),
        api.get<DeviceListResponse>('/devices/'),
      ]);
      setDrivers(drvRes.data);
      setDevices(devRes.data.devices);
      setError('');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchCommands = useCallback(async () => {
    try {
      const res = await api.get('/ibuttons/commands', { params: { limit: 15 } });
      setCommands(res.data.commands || res.data);
    } catch { /* commands log optional */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchCommands();
  }, [fetchData, fetchCommands]);

  const openCreate = () => {
    setEditDriver(null);
    setForm({ full_name: '', ibutton_id: '', device_imei: '', phone: '', document: '', expiry: '', notes: '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (d: DriverRegistry) => {
    setEditDriver(d);
    setForm({
      full_name: d.full_name,
      ibutton_id: d.ibutton_id,
      device_imei: d.device_imei || '',
      phone: d.phone || '',
      document: d.document || '',
      expiry: d.expiry ? d.expiry.slice(0, 10) : '',
      notes: d.notes || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const saveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.full_name.trim() || !form.ibutton_id.trim()) {
      setFormError(t('ibuttons.drv_required'));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        ibutton_id: form.ibutton_id.trim(),
        device_imei: form.device_imei || null,
        phone: form.phone || null,
        document: form.document || null,
        expiry: form.expiry ? new Date(form.expiry + 'T12:00:00Z').toISOString().replace(/\.\d+/, '') : null,
        notes: form.notes || null,
      };
      if (editDriver) {
        await api.put(`/ibuttons/drivers/${editDriver.id}`, payload);
        setNotice(t('ibuttons.drv_updated'));
      } else {
        await api.post('/ibuttons/drivers/', payload);
        setNotice(t('ibuttons.drv_created'));
      }
      setShowForm(false);
      await fetchData();
      await fetchCommands();
      setTimeout(() => setNotice(''), 3000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(typeof detail === 'string' ? detail : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const removeDriver = async (d: DriverRegistry) => {
    if (!window.confirm(t('ibuttons.drv_delete_confirm', { name: d.full_name }))) return;
    try {
      await api.delete(`/ibuttons/drivers/${d.id}`);
      setNotice(t('ibuttons.drv_deleted'));
      await fetchData();
      await fetchCommands();
      setTimeout(() => setNotice(''), 3000);
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

  const q = search.trim().toLowerCase();
  const filtered = drivers.filter(
    (d) =>
      !q ||
      d.full_name.toLowerCase().includes(q) ||
      d.ibutton_id.toLowerCase().includes(q) ||
      (d.device_name || '').toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('ibuttons.title')}</h1>
          <p className="text-gray-500 mt-1">{t('ibuttons.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {isAdmin && (
            <button
              onClick={openCreate}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('ibuttons.drv_add')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{notice}</div>
      )}

      {/* concept explanation */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm mb-4">
        💡 {t('ibuttons.drv_concept')}
      </div>

      {/* drivers table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">{t('ibuttons.drv_empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('ibuttons.drv_name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">iButton ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('ibuttons.drv_vehicle')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('ibuttons.drv_phone')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('ibuttons.drv_expiry')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('devices.status')}</th>
                  {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {d.full_name}
                      {d.document && <span className="text-gray-400 text-xs ml-2">{d.document}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{d.ibutton_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.device_name || d.device_imei || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{d.expiry ? new Date(d.expiry).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {d.is_active ? t('users.active') : t('users.inactive')}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title={t('vehicles.edit')}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => removeDriver(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title={t('common.delete')}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* command log */}
      {commands.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">{t('ibuttons.commands_log')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">{t('ibuttons.drv_name')}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">iButton</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Cmd</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600 uppercase">{t('devices.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commands.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-600">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 font-mono">{c.device_imei}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 font-mono">{c.ibutton_id || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {c.command_type === 144 ? `➕ ${t('ibuttons.add')}` : c.command_type === 145 ? `➖ ${t('ibuttons.remove')}` : c.command_type}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === 'sent' || c.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        c.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {t(`ibuttons.${c.status}`) || c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* create/edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editDriver ? t('ibuttons.drv_edit') : t('ibuttons.drv_add')}
            </h2>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-3">{formError}</div>
            )}
            <form onSubmit={saveDriver} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {t('ibuttons.drv_name')} <span className="text-red-500">*</span>
                  </label>
                  <input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    iButton ID <span className="text-red-500">*</span>
                  </label>
                  <input className={inputCls} value={form.ibutton_id} onChange={(e) => setForm({ ...form, ibutton_id: e.target.value.trim() })} placeholder="A1B2C3..." required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('ibuttons.drv_vehicle')}</label>
                  <select className={inputCls} value={form.device_imei} onChange={(e) => setForm({ ...form, device_imei: e.target.value })}>
                    <option value="">— {t('ibuttons.drv_no_vehicle')} —</option>
                    {devices.map((d) => (
                      <option key={d.imei} value={d.imei}>{d.device_name || d.imei}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{t('ibuttons.drv_vehicle_hint')}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('ibuttons.drv_phone')}</label>
                  <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('ibuttons.drv_doc')}</label>
                  <input className={inputCls} value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('ibuttons.drv_expiry')}</label>
                  <input type="date" className={inputCls} value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card Reader</label>
                  <input className={`${inputCls} bg-gray-50 text-gray-500`} value="IBUTTON" disabled />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('ibuttons.drv_notes')}</label>
                  <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
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