import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import type { TenantSetting } from '@/types';

export function TenantSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();

  const [settings, setSettings] = useState<TenantSetting[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (currentTenant) loadSettings();
  }, [currentTenant?.id]);

  const loadSettings = async () => {
    if (!currentTenant) return;
    try {
      // Use apiClient (Edge Function) so auth headers are attached automatically
      const res = await apiClient.get<TenantSetting[]>('/tenant-settings');
      setSettings(res.data || []);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddSetting = async (e: FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    setError('');
    setSaving(true);

    try {
      await apiClient.put('/tenant-settings', { key: newKey, value: newValue });
      setNewKey('');
      setNewValue('');
      setSuccess(t('settings.saved'));
      setTimeout(() => setSuccess(''), 3000);
      await loadSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await apiClient.delete(`/tenant-settings?key=${encodeURIComponent(key)}`);
      setSuccess(t('settings.deleted'));
      setTimeout(() => setSuccess(''), 3000);
      await loadSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="glass-card p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{t('settings.title')}</h1>

      {error && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
          {success}
        </div>
      )}

      {/* Add new setting */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-medium text-text-secondary mb-4">{t('settings.addSetting')}</h2>
        <form onSubmit={handleAddSetting} className="flex gap-3">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="input-field flex-1"
            placeholder={t('settings.key')}
            required
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="input-field flex-1"
            placeholder={t('settings.value')}
          />
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm whitespace-nowrap">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>

      {/* Settings list */}
      <div className="glass-card divide-y divide-glass-border overflow-hidden">
        {settings.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {t('settings.noSettings')}
          </div>
        ) : (
          settings.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-glass-hover transition-colors">
              <div>
                <span className="font-mono text-sm text-brand-secondary">{s.key}</span>
                <span className="mx-3 text-text-muted">—</span>
                <span className="text-sm text-text-primary">{s.value}</span>
              </div>
              <button
                onClick={() => handleDelete(s.key)}
                className="btn btn-ghost btn-sm text-text-muted hover:text-error"
              >
                {t('common.delete')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
