import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { UserListResponse, UserCreatePayload, UserUpdatePayload, Sector } from '../types';

export default function UsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserListResponse[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListResponse | null>(null);
  const [formData, setFormData] = useState<UserCreatePayload>({
    email: '',
    password: '',
    name: '',
    role: 'supervisor',
    sector_id: null,
  });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get<UserListResponse[]>('/users/');
      setUsers(res.data);
      setError('');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchSectors = useCallback(async () => {
    try {
      const res = await api.get<Sector[]>('/sectors/');
      setSectors(res.data);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchSectors();
  }, [fetchUsers, fetchSectors]);

  const resetForm = () => {
    setFormData({ email: '', password: '', name: '', role: 'supervisor', sector_id: null });
    setEditingUser(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (u: UserListResponse) => {
    setEditingUser(u);
    setFormData({
      email: u.email,
      password: '',
      name: u.name,
      role: u.role,
      sector_id: u.sector_id,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        // Update existing user
        const payload: UserUpdatePayload = {
          name: formData.name,
          role: formData.role,
          sector_id: formData.role === 'admin' ? null : formData.sector_id,
        };
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        // Create new user
        const payload: UserCreatePayload = {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          sector_id: formData.role === 'admin' ? null : formData.sector_id,
        };
        await api.post('/users/', payload);
      }
      closeModal();
      await fetchUsers();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserListResponse) => {
    setError('');
    try {
      await api.delete(`/users/${u.id}`);
      await fetchUsers();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('common.error'));
    }
  };

  const getSectorName = (sectorId: number | null, sectorName: string | null) => {
    if (sectorId === null || sectorId === undefined) return '—';
    if (sectorName) return sectorName;
    const sector = sectors.find((s) => s.id === sectorId);
    return sector?.name ?? '—';
  };

  // Non-admin access guard
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">403 — {t('common.error')}</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-800">{t('users.title')}</h1>
          <p className="text-gray-500 mt-1">{t('users.subtitle')}</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('users.new')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 text-sm">—</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('users.name')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('users.email')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('users.role')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('users.sector')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('users.status')}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role === 'admin' ? t('users.role_admin') : t('users.role_supervisor')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getSectorName(u.sector_id, u.sector_name)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? t('users.active') : t('users.inactive')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {t('users.edit')}
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={u.id === currentUser?.id}
                          className={`text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed ${
                            u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                          }`}
                        >
                          {u.is_active ? t('users.deactivate') : t('users.activate')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editingUser ? t('users.edit') : t('users.new')}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('users.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled={!!editingUser}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="user@example.com"
                />
              </div>

              {/* Password (only for new users) */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('users.password')}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="******"
                  />
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('users.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">{t('users.role')}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'supervisor' })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="admin">{t('users.role_admin')}</option>
                  <option value="supervisor">{t('users.role_supervisor')}</option>
                </select>
              </div>

              {/* Sector (only for supervisors) */}
              {formData.role === 'supervisor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">{t('users.sector')}</label>
                  <select
                    value={formData.sector_id ?? ''}
                    onChange={(e) => setFormData({ ...formData, sector_id: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{t('devices.no_sector')}</option>
                    {sectors.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                {saving ? t('common.loading') : t('users.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}