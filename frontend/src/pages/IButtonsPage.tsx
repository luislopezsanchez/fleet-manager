import { useState, useEffect, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import type { DeviceListResponse, Device, CommandLog, CommandListResponse, BatchResult, UploadResult } from '../types';

interface CsvRow {
  vehicle_imei: string;
  ibutton_id: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const imeiIdx = headers.indexOf('vehicle_imei');
  const ibuttonIdx = headers.indexOf('ibutton_id');
  if (imeiIdx === -1 || ibuttonIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const imei = cols[imeiIdx]?.trim();
    const ibuttonId = cols[ibuttonIdx]?.trim();
    if (imei && ibuttonId) rows.push({ vehicle_imei: imei, ibutton_id: ibuttonId });
  }
  return rows;
}

export default function IButtonsPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [batchIbuttonId, setBatchIbuttonId] = useState('');
  const [selectedImeis, setSelectedImeis] = useState<Set<string>>(new Set());
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [commands, setCommands] = useState<CommandLog[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await api.get<DeviceListResponse>('/devices/');
      setDevices(res.data.devices);
    } catch {
      // silent
    }
  }, []);

  const loadCommands = useCallback(async () => {
    try {
      const res = await api.get<CommandListResponse>('/ibuttons/commands', {
        params: { limit: 50 },
      });
      setCommands(res.data.commands);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadDevices();
    loadCommands();
  }, [loadDevices, loadCommands]);

  const handleFile = (file: File) => {
    setCsvFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError('CSV must have columns: vehicle_imei, ibutton_id');
        setCsvRows([]);
        return;
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleExecuteUpload = async () => {
    if (csvRows.length === 0) return;
    setExecuting(true);
    setError('');
    setSuccess('');
    setUploadResult(null);
    try {
      const csvText = csvRows.map((r) => `${r.vehicle_imei},${r.ibutton_id}`).join('\n');
      const csvContent = `vehicle_imei,ibutton_id\n${csvText}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, csvFileName || 'ibuttons.csv');

      const res = await api.post<UploadResult>('/ibuttons/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      setSuccess(`Processed ${res.data.processed} rows — ${res.data.succeeded} succeeded, ${res.data.failed} failed`);
      setCsvRows([]);
      setCsvFileName('');
      loadCommands();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || t('common.error');
      setError(msg);
    } finally {
      setExecuting(false);
    }
  };

  const handleToggleImei = (imei: string) => {
    setSelectedImeis((prev) => {
      const next = new Set(prev);
      if (next.has(imei)) next.delete(imei);
      else next.add(imei);
      return next;
    });
  };

  const handleBatchAction = async (action: 'add' | 'remove') => {
    if (selectedImeis.size === 0 || !batchIbuttonId) {
      setError('Select devices and enter iButton ID');
      return;
    }
    setExecuting(true);
    setError('');
    setSuccess('');
    setBatchResult(null);
    try {
      const operations = Array.from(selectedImeis).map((imei) => ({
        imei,
        ibutton_id: batchIbuttonId,
        action,
      }));
      const res = await api.post<BatchResult>('/ibuttons/batch', { operations });
      setBatchResult(res.data);
      setSuccess(`${res.data.succeeded}/${res.data.total} commands succeeded`);
      setSelectedImeis(new Set());
      setBatchIbuttonId('');
      loadCommands();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || t('common.error');
      setError(msg);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('ibuttons.title')}</h1>
        <p className="text-gray-500 mt-1">{t('ibuttons.subtitle')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* CSV Upload Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('ibuttons.csv_upload')}</h2>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600">
              {csvFileName || 'Drop CSV here or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Columns: vehicle_imei, ibutton_id</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* CSV Preview */}
          {csvRows.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">{csvRows.length} rows preview:</p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">vehicle_imei</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">ibutton_id</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {csvRows.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-sm text-gray-700 font-mono">{row.vehicle_imei}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 font-mono">{row.ibutton_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleExecuteUpload}
                disabled={executing}
                className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {executing ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                {t('ibuttons.execute')}
              </button>
            </div>
          )}

          {uploadResult && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Result:</span> {uploadResult.succeeded} succeeded, {uploadResult.failed} failed, {uploadResult.total_rows} total
            </div>
          )}
        </div>

        {/* Batch Operations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">{t('ibuttons.batch')}</h2>

          {/* Device selection */}
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-8"></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Device</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">IMEI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {devices.slice(0, 100).map((dev) => (
                  <tr
                    key={dev.imei}
                    onClick={() => handleToggleImei(dev.imei)}
                    className={`cursor-pointer hover:bg-gray-50 ${selectedImeis.has(dev.imei) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedImeis.has(dev.imei)}
                        onChange={() => handleToggleImei(dev.imei)}
                        className="rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{dev.device_name || dev.imei}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-mono">{dev.imei}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={batchIbuttonId}
              onChange={(e) => setBatchIbuttonId(e.target.value)}
              placeholder="iButton ID"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={() => handleBatchAction('add')}
              disabled={executing || !batchIbuttonId || selectedImeis.size === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {t('ibuttons.add')}
            </button>
            <button
              onClick={() => handleBatchAction('remove')}
              disabled={executing || !batchIbuttonId || selectedImeis.size === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              {t('ibuttons.remove')}
            </button>
          </div>

          {selectedImeis.size > 0 && (
            <p className="text-sm text-gray-500 mt-2">{selectedImeis.size} devices selected</p>
          )}

          {batchResult && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Result:</span> {batchResult.succeeded}/{batchResult.total} succeeded
            </div>
          )}
        </div>
      </div>

      {/* Commands Log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">{t('ibuttons.commands_log')}</h2>
        </div>
        {commands.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No commands sent yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">IMEI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Cmd</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">iButton ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('ibuttons.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {commands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600">{cmd.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{cmd.device_imei}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cmd.command_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{cmd.ibutton_id || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[cmd.status] || statusColors.pending}`}>
                        {t(`ibuttons.${cmd.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(cmd.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}