import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, RefreshCw, Download } from 'lucide-react';
import { SearchSelect, type SelectOption } from '@/components/ui/SearchSelect';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Platform, Model } from '@/types';
import { PLATFORM_GRADIENTS, SYNCABLE_PLATFORMS } from '@/types/dashboard';

export function PlatformsPage() {
  const { t } = useTranslation();

  const { showToast } = useToast();

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [modelsMap, setModelsMap] = useState<Record<string, Model[]>>({});

  const [syncing, setSyncing] = useState<string | null>(null);

  const loadPlatforms = useCallback(async () => {
    try {
      const res = await apiClient.get<Platform[]>('/platforms');
      setPlatforms(res.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPlatforms();
  }, [loadPlatforms]);

  // Pre-load models for all platforms
  useEffect(() => {
    platforms.forEach((p) => loadModels(p.id));
  }, [platforms]);

  const loadModels = async (platformId: string) => {
    if (modelsMap[platformId]) return;
    try {
      const res = await apiClient.get<Model[]>(`/platforms/models?platformId=${platformId}`);
      setModelsMap((prev) => ({ ...prev, [platformId]: res.data }));
    } catch {
      setError(t('common.error'));
    }
  };

  const handleToggle = async (platform: Platform) => {
    setToggling(platform.id);
    try {
      await apiClient.put('/platforms', {
        id: platform.id,
        is_active: !platform.is_active,
      });
      showToast(
        platform.is_active
          ? t('platforms.deactivated', { name: platform.name })
          : t('platforms.activated', { name: platform.name }),
      );
      await loadPlatforms();
    } catch {
      setError(t('common.error'));
    } finally {
      setToggling(null);
    }
  };

  const handleModelSelect = async (platform: Platform, modelId: string) => {
    try {
      await apiClient.put('/platforms', {
        id: platform.id,
        default_model_id: modelId,
      });
      showToast(t('platforms.modelUpdated'));
      await loadPlatforms();
    } catch {
      setError(t('common.error'));
    }
  };


  const handleSync = async (platform: Platform) => {
    setSyncing(platform.id);
    try {
      const res = await apiClient.post<{ synced: number; message?: string }>(
        `/platforms/sync?platformId=${platform.id}`,
      );
      const { synced, message } = res.data;
      showToast(message || t('platforms.synced', { count: synced }));
      // Refresh models cache
      setModelsMap((prev) => ({ ...prev, [platform.id]: undefined as unknown as Model[] }));
    } catch {
      setError(t('common.error'));
    } finally {
      setSyncing(null);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="dashboard-card p-6">
              <div className="skeleton h-6 w-32 mb-3" />
              <div className="skeleton h-4 w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {t('platforms.title')}
          </h1>
          <p className="text-sm text-text-muted mt-1">{t('platforms.subtitle')}</p>
        </div>
        <button onClick={loadPlatforms} className="icon-btn" title={t('common.refresh')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Platform Cards */}
      {platforms.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <Cpu className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('platforms.noPlatforms')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map((platform) => {
            const models = modelsMap[platform.id] || [];
            const modelOptions: SelectOption[] = models.map((m) => ({
              value: m.id,
              label: `${m.name} (${m.slug})`,
            }));


            return (
              <div key={platform.id} className="dashboard-card p-5 space-y-4">
                {/* Top row: logo/name + toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xs bg-gradient-to-br ${
                        PLATFORM_GRADIENTS[platform.slug] || 'from-gray-500 to-gray-700'
                      } flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {platform.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-text-primary">
                        {platform.name}
                      </span>
                      <span className="block text-xs text-text-muted">{platform.slug}</span>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={() => handleToggle(platform)}
                    disabled={toggling === platform.id}
                    className="toggle-switch"
                    data-active={platform.is_active}
                    role="switch"
                    aria-checked={platform.is_active}
                  >
                    <span className="toggle-switch-thumb" />
                  </button>
                </div>

                {/* Model selector */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {t('platforms.defaultModel')}
                  </label>
                  <SearchSelect
                    options={modelOptions}
                    value={platform.default_model_id || ''}
                    onChange={(val) => handleModelSelect(platform, val)}
                    placeholder={platform.default_model?.name || platform.default_model?.slug || '—'}
                    searchPlaceholder={t('common.search')}
                  />
                </div>

                {/* Status + Sync */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        platform.is_active ? 'bg-success' : 'bg-text-muted'
                      }`}
                    />
                    <span className="text-xs text-text-muted">
                      {platform.is_active ? t('platforms.active') : t('platforms.inactive')}
                    </span>
                  </div>
                  {SYNCABLE_PLATFORMS.has(platform.slug) && (
                    <button
                      onClick={() => handleSync(platform)}
                      disabled={syncing === platform.id}
                      className="btn btn-ghost btn-sm text-[11px] gap-1"
                      title={t('platforms.syncModels')}
                    >
                      <Download className={`w-3.5 h-3.5 ${syncing === platform.id ? 'animate-spin' : ''}`} />
                      {t('platforms.syncModels')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
