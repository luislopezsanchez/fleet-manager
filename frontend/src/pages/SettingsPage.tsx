import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import type { Sector } from '../types';

// ── AI Provider presets ──────────────────────────────────────────────────────
const PROVIDER_PRESETS: Record<string, { base_url: string; label_key: string }> = {
  deepseek: { base_url: 'https://api.deepseek.com/v1', label_key: 'settings.provider_deepseek' },
  ollama: { base_url: 'https://api.ollama.com/v1', label_key: 'settings.provider_ollama' },
  openai: { base_url: 'https://api.openai.com/v1', label_key: 'settings.provider_openai' },
  gemini: { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', label_key: 'settings.provider_gemini' },
};

export default function SettingsPage() {
  const { t } = useTranslation();

  // ── AI Config state ──────────────────────────────────────────────────────
  const [aiProvider, setAiProvider] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [validatedModels, setValidatedModels] = useState<string[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [currentConfig, setCurrentConfig] = useState<{ provider: string; model: string; base_url: string; api_key_masked: string } | null>(null);

  // ── Sectors state ────────────────────────────────────────────────────────
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorName, setSectorName] = useState('');
  const [sectorDesc, setSectorDesc] = useState('');
  const [editingSectorId, setEditingSectorId] = useState<number | null>(null);
  const [sectorMessage, setSectorMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Load current AI config ───────────────────────────────────────────────
  const loadCurrentConfig = useCallback(async () => {
    try {
      const resp = await api.get('/settings/ai/current');
      setCurrentConfig(resp.data);
    } catch (err) {
      // silent fail on first load
    }
  }, []);

  // ── Load sectors ─────────────────────────────────────────────────────────
  const loadSectors = useCallback(async () => {
    try {
      const resp = await api.get('/sectors/');
      setSectors(resp.data);
    } catch (err) {
      // silent fail
    }
  }, []);

  useEffect(() => {
    loadCurrentConfig();
    loadSectors();
  }, [loadCurrentConfig, loadSectors]);

  // ── AI handlers ──────────────────────────────────────────────────────────
  const handleProviderChange = (provider: string) => {
    setAiProvider(provider);
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setAiBaseUrl(preset.base_url);
    }
    setIsValidated(false);
    setValidatedModels([]);
    setAiMessage(null);
  };

  const handleValidate = async () => {
    if (!aiBaseUrl || !aiApiKey) {
      setAiMessage({ type: 'error', text: t('settings.ai_invalid') });
      return;
    }
    setValidating(true);
    setAiMessage(null);
    try {
      const resp = await api.post('/settings/ai/test', {
        provider: aiProvider,
        api_key: aiApiKey,
        base_url: aiBaseUrl,
      });
      if (resp.data.valid) {
        setIsValidated(true);
        setValidatedModels(resp.data.models || []);
        if (resp.data.models && resp.data.models.length > 0 && !aiModel) {
          setAiModel(resp.data.models[0]);
        }
        setAiMessage({ type: 'success', text: t('settings.ai_valid') });
      } else {
        setIsValidated(false);
        setValidatedModels([]);
        setAiMessage({ type: 'error', text: `${t('settings.ai_invalid')}${resp.data.error ? ': ' + resp.data.error : ''}` });
      }
    } catch (err: any) {
      setIsValidated(false);
      setValidatedModels([]);
      setAiMessage({ type: 'error', text: err?.response?.data?.detail || t('settings.ai_invalid') });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!aiProvider || !aiApiKey || !aiModel || !aiBaseUrl) {
      setAiMessage({ type: 'error', text: t('settings.ai_invalid') });
      return;
    }
    setSaving(true);
    setAiMessage(null);
    try {
      await api.post('/settings/ai/save', {
        provider: aiProvider,
        api_key: aiApiKey,
        model: aiModel,
        base_url: aiBaseUrl,
      });
      setAiMessage({ type: 'success', text: t('settings.ai_save') + ' ✓' });
      await loadCurrentConfig();
    } catch (err: any) {
      setAiMessage({ type: 'error', text: err?.response?.data?.detail || t('settings.ai_invalid') });
    } finally {
      setSaving(false);
    }
  };

  // ── Sector handlers ──────────────────────────────────────────────────────
  const handleSectorSubmit = async () => {
    if (!sectorName.trim()) {
      setSectorMessage({ type: 'error', text: 'Name required' });
      return;
    }
    try {
      if (editingSectorId) {
        await api.put(`/sectors/${editingSectorId}`, {
          name: sectorName,
          description: sectorDesc || null,
        });
      } else {
        await api.post('/sectors/', {
          name: sectorName,
          description: sectorDesc || null,
        });
      }
      setSectorName('');
      setSectorDesc('');
      setEditingSectorId(null);
      setSectorMessage({ type: 'success', text: '✓' });
      await loadSectors();
    } catch (err: any) {
      setSectorMessage({ type: 'error', text: err?.response?.data?.detail || 'Error' });
    }
  };

  const handleSectorEdit = (s: Sector) => {
    setEditingSectorId(s.id);
    setSectorName(s.name);
    setSectorDesc(s.description || '');
  };

  const handleSectorDelete = async (id: number) => {
    if (!confirm('Delete sector?')) return;
    try {
      await api.delete(`/sectors/${id}`);
      await loadSectors();
    } catch (err: any) {
      setSectorMessage({ type: 'error', text: err?.response?.data?.detail || 'Error' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="dark:text-gray-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('settings.title')}</h1>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* ── General: Language + Theme ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">General</h2>
          <div className="space-y-4">
            {/* Language */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{t('settings.language')}</h3>
                <p className="text-xs text-gray-500 mt-1">Español / English / Português</p>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* ── AI Provider ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('settings.ai_provider')}</h2>

          {/* Current config display */}
          {currentConfig && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">{t('settings.ai_current')}</p>
              <p className="text-sm text-gray-700">
                Provider: <span className="font-medium">{currentConfig.provider}</span> | 
                Model: <span className="font-medium">{currentConfig.model}</span> | 
                API Key: <span className="font-mono">{currentConfig.api_key_masked}</span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Provider selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.ai_provider')}</label>
              <select
                value={aiProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">— Select —</option>
                <option value="deepseek">{t('settings.provider_deepseek')}</option>
                <option value="ollama">{t('settings.provider_ollama')}</option>
                <option value="openai">{t('settings.provider_openai')}</option>
                <option value="gemini">{t('settings.provider_gemini')}</option>
              </select>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                value={aiBaseUrl}
                onChange={(e) => { setAiBaseUrl(e.target.value); setIsValidated(false); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://api.example.com/v1"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.ai_apikey')}</label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => { setAiApiKey(e.target.value); setIsValidated(false); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="sk-..."
              />
            </div>

            {/* Validate button */}
            <button
              onClick={handleValidate}
              disabled={validating || !aiBaseUrl || !aiApiKey}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? '...' : t('settings.ai_validate')}
            </button>

            {/* Model selector (shown after validation) */}
            {isValidated && validatedModels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.ai_model')}</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {validatedModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual model input (if validation returned no models) */}
            {isValidated && validatedModels.length === 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.ai_model')}</label>
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="model-name"
                />
              </div>
            )}

            {/* Save button */}
            {isValidated && (
              <button
                onClick={handleSave}
                disabled={saving || !aiModel}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '...' : t('settings.ai_save')}
              </button>
            )}

            {/* Message */}
            {aiMessage && (
              <p className={`text-sm ${aiMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {aiMessage.text}
              </p>
            )}
          </div>
        </div>

        {/* ── Sectors ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('settings.sectors')}</h2>

          {/* Sector list */}
          <div className="space-y-2 mb-4">
            {sectors.length === 0 ? (
              <p className="text-sm text-gray-400">—</p>
            ) : (
              sectors.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{s.name}</span>
                    {s.description && (
                      <span className="text-xs text-gray-500 ml-2">{s.description}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSectorEdit(s)}
                      className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      {t('settings.sector_edit')}
                    </button>
                    <button
                      onClick={() => handleSectorDelete(s.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      {t('settings.sector_delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sector create/edit form */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={sectorName}
                onChange={(e) => setSectorName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="..."
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={sectorDesc}
                onChange={(e) => setSectorDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="..."
              />
            </div>
            <button
              onClick={handleSectorSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {editingSectorId ? t('settings.sector_edit') : t('settings.sector_new')}
            </button>
            {editingSectorId && (
              <button
                onClick={() => { setEditingSectorId(null); setSectorName(''); setSectorDesc(''); }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                ✕
              </button>
            )}
          </div>
          {sectorMessage && (
            <p className={`text-sm mt-2 ${sectorMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {sectorMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}