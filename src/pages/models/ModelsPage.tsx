import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Plus, Trash2, RefreshCw, X, Search, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import type { Platform, Model, TenantPlatformModel } from '@/types';

const PLATFORM_COLORS: Record<string, string> = {
  openai: 'from-emerald-500 to-green-600',
  anthropic: 'from-orange-400 to-amber-600',
  gemini: 'from-blue-500 to-indigo-600',
  grok: 'from-slate-600 to-slate-800',
  perplexity: 'from-cyan-500 to-teal-600',
};

export function ModelsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const isSA = !!profile?.is_sa;

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [modelsMap, setModelsMap] = useState<Record<string, Model[]>>({});
  const [preferences, setPreferences] = useState<TenantPlatformModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add model flow
  const [addingPlatformId, setAddingPlatformId] = useState<string | null>(null);
  const [addingModelId, setAddingModelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [platformsRes, prefsRes] = await Promise.all([
        apiClient.get<Platform[]>('/platforms'),
        apiClient.get<TenantPlatformModel[]>('/platforms/preferences'),
      ]);
      const activePlatforms = platformsRes.data.filter((p: Platform) => p.is_active);
      setPlatforms(activePlatforms);
      setPreferences(prefsRes.data);

      // Preload all models for all active platforms
      const modelResults = await Promise.all(
        activePlatforms.map((p) =>
          apiClient.get<Model[]>(`/platforms/models?platformId=${p.id}`).then((r) => ({ id: p.id, models: r.data }))
        ),
      );
      const map: Record<string, Model[]> = {};
      for (const { id, models } of modelResults) map[id] = models;
      setModelsMap(map);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Load models for a platform when selecting it
  const loadModelsForPlatform = async (platformId: string) => {
    if (modelsMap[platformId]) return;
    try {
      const res = await apiClient.get<Model[]>(`/platforms/models?platformId=${platformId}`);
      setModelsMap((prev) => ({ ...prev, [platformId]: res.data }));
    } catch {
      setError(t('common.error'));
    }
  };

  const handleSelectPlatform = (platformId: string) => {
    if (addingPlatformId === platformId) {
      setAddingPlatformId(null);
      setAddingModelId(null);
    } else {
      setAddingPlatformId(platformId);
      setAddingModelId(null);
      loadModelsForPlatform(platformId);
    }
  };

  const handleAddModel = async () => {
    if (!addingPlatformId || !addingModelId) return;

    setSaving(true);
    try {
      await apiClient.post('/platforms/preferences', {
        platform_id: addingPlatformId,
        model_id: addingModelId,
        is_active: true,
      });
      showToast(t('models.added'));
      setAddingPlatformId(null);
      setAddingModelId(null);
      await loadAll();
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pref: TenantPlatformModel) => {
    setTogglingId(pref.id);
    try {
      await apiClient.post('/platforms/preferences', {
        platform_id: pref.platform_id,
        model_id: pref.model_id,
        is_active: !pref.is_active,
      });
      showToast(
        pref.is_active ? t('models.deactivated') : t('models.activated'),
      );
      await loadAll();
    } catch {
      setError(t('common.error'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (pref: TenantPlatformModel) => {
    setDeletingId(pref.id);
    try {
      await apiClient.delete(`/platforms/preferences?id=${pref.id}`);
      showToast(t('models.removed'));
      await loadAll();
    } catch {
      setError(t('common.error'));
    } finally {
      setDeletingId(null);
    }
  };

  // Filter out models already added as preferences for current platform
  const getAvailableModels = (platformId: string): Model[] => {
    const models = modelsMap[platformId] || [];
    const existingModelIds = new Set(
      preferences
        .filter((p) => p.platform_id === platformId)
        .map((p) => p.model_id),
    );
    return models.filter((m) => !existingModelIds.has(m.id));
  };

  // Group preferences by platform
  const groupedPreferences = preferences.reduce<Record<string, TenantPlatformModel[]>>(
    (acc, pref) => {
      const key = pref.platform?.slug || pref.platform_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pref);
      return acc;
    },
    {},
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {t('models.title')}
          </h1>
          <p className="text-sm text-text-muted mt-1">{t('models.subtitle')}</p>
        </div>
        <button onClick={loadAll} className="icon-btn" title={t('common.refresh')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Add Model Section */}
      <div className="dashboard-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-primary" />
          {t('models.addModel')}
        </h2>

        {/* Platform selector */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">
            {t('models.selectPlatform')}
          </label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => {
              const exhausted = getAvailableModels(platform.id).length === 0;
              return (
                <button
                  key={platform.id}
                  onClick={() => !exhausted && handleSelectPlatform(platform.id)}
                  disabled={exhausted}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-sm font-medium transition-all duration-200 ${
                    exhausted
                      ? 'bg-bg-tertiary/50 text-text-muted/50 border border-glass-border/50 cursor-default line-through'
                      : addingPlatformId === platform.id
                        ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/40 shadow-sm shadow-brand-primary/10'
                        : 'bg-bg-tertiary text-text-muted border border-glass-border hover:border-text-muted hover:text-text-secondary'
                  }`}
                >
                  {exhausted ? (
                    <Check className="w-3 h-3 text-success/60" />
                  ) : (
                    <span
                      className={`w-2 h-2 rounded-full bg-gradient-to-br ${
                        PLATFORM_COLORS[platform.slug] || 'from-gray-500 to-gray-700'
                      }`}
                    />
                  )}
                  {platform.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model selector (shows when platform is selected) */}
        {addingPlatformId && (() => {
          const available = getAvailableModels(addingPlatformId);
          const singleModelAutoSelect = !isSA && available.length === 1;

          // Auto-select the only model for non-SA users
          if (singleModelAutoSelect && addingModelId !== available[0]!.id) {
            // Use a microtask to avoid setState during render
            Promise.resolve().then(() => setAddingModelId(available[0]!.id));
          }

          return (
            <div className="space-y-3 animate-fade-in">
              {/* Only show model picker if SA or multiple models */}
              {!singleModelAutoSelect && (
                <>
                  <label className="block text-xs font-medium text-text-secondary">
                    {t('models.selectModel')}
                  </label>
                  {available.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">
                      {t('models.allModelsAdded')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {available.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setAddingModelId(model.id)}
                          className={`text-left px-3 py-2 rounded-xs text-sm transition-all duration-200 border ${
                            addingModelId === model.id
                              ? 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                              : 'bg-bg-tertiary border-glass-border text-text-secondary hover:border-text-muted'
                          }`}
                        >
                          <span className="font-medium block">{model.name}</span>
                          <span className="text-[10px] text-text-muted">{model.slug}</span>
                          {model.web_search_active && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.5 rounded-full">
                              <Search className="w-2.5 h-2.5" />
                              {t('models.webSearch')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Add button */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleAddModel}
                  disabled={!addingModelId || saving}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {saving ? t('common.loading') : t('models.add')}
                </button>
                <button
                  onClick={() => {
                    setAddingPlatformId(null);
                    setAddingModelId(null);
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Selected Models */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-secondary" />
          {t('models.yourModels')} ({preferences.length})
        </h2>

        {preferences.length === 0 ? (
          <div className="dashboard-card p-12 text-center">
            <Layers className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">{t('models.noModels')}</p>
          </div>
        ) : (
          Object.entries(groupedPreferences).map(([platformSlug, prefs]) => {
            const platform = prefs[0]?.platform;
            const isSingleModel = prefs.length === 1;
            const hideModelDetails = isSingleModel && !isSA;
            const firstPref = prefs[0]!; // safe — grouped entries always have at least 1

            return (
              <div key={platformSlug} className="dashboard-card overflow-hidden">
                {/* Platform header */}
                <div className={`px-5 py-3 ${hideModelDetails ? '' : 'border-b border-glass-border/50'} flex items-center gap-3`}>
                  <div
                    className={`w-7 h-7 rounded-xs bg-gradient-to-br ${
                      PLATFORM_COLORS[platformSlug] || 'from-gray-500 to-gray-700'
                    } flex items-center justify-center text-white text-[10px] font-bold`}
                  >
                    {platform?.name?.charAt(0) || '?'}
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    {platform?.name || platformSlug}
                  </span>
                  {!hideModelDetails && (
                    <span className="text-xs text-text-muted">
                      {prefs.length} {prefs.length === 1 ? 'model' : 'models'}
                    </span>
                  )}

                  {/* When hiding model details, show controls inline */}
                  {hideModelDetails && (
                    <div className="ml-auto flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          firstPref.is_active
                            ? 'bg-success/10 text-success'
                            : 'bg-text-muted/10 text-text-muted'
                        }`}
                      >
                        {firstPref.is_active ? t('platforms.active') : t('platforms.inactive')}
                      </span>
                      <button
                        onClick={() => handleToggle(firstPref)}
                        disabled={togglingId === firstPref.id}
                        className="toggle-switch"
                        data-active={firstPref.is_active}
                        role="switch"
                        aria-checked={firstPref.is_active}
                      >
                        <span className="toggle-switch-thumb" />
                      </button>
                      <button
                        onClick={() => handleDelete(firstPref)}
                        disabled={deletingId === firstPref.id}
                        className="icon-btn text-text-muted hover:text-error transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingId === firstPref.id ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Model rows — hidden when single model for non-SA */}
                {!hideModelDetails && (
                  <div className="divide-y divide-glass-border/30">
                    {prefs.map((pref) => (
                      <div
                        key={pref.id}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-glass-hover/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-text-primary block truncate">
                            {pref.model?.name || pref.model_id}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {pref.model?.slug}
                          </span>
                          {pref.model?.web_search_active && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-brand-secondary bg-brand-secondary/10 px-1.5 py-0.5 rounded-full ml-2">
                              <Search className="w-2.5 h-2.5" />
                              {t('models.webSearch')}
                            </span>
                          )}
                        </div>

                        {/* Status badge */}
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                            pref.is_active
                              ? 'bg-success/10 text-success'
                              : 'bg-text-muted/10 text-text-muted'
                          }`}
                        >
                          {pref.is_active ? t('platforms.active') : t('platforms.inactive')}
                        </span>

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggle(pref)}
                          disabled={togglingId === pref.id}
                          className="toggle-switch"
                          data-active={pref.is_active}
                          role="switch"
                          aria-checked={pref.is_active}
                        >
                          <span className="toggle-switch-thumb" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(pref)}
                          disabled={deletingId === pref.id}
                          className="icon-btn text-text-muted hover:text-error transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingId === pref.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
