import { useState, useEffect, Fragment } from 'react';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { useTranslation } from 'react-i18next';
import { Globe, Plus, Pencil, Trash2, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminCrud } from './useAdminCrud';
import { apiClient } from '@/lib/api';

interface Platform {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  default_model_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Model { id: string; name: string; slug: string; platform_id: string; }

export function PlatformsPage() {
  const { t } = useTranslation();
  const { data: platforms, isLoading, create, update, remove } = useAdminCrud<Platform>('platforms');
  const [models, setModels] = useState<Model[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: '', name: '', is_active: true, default_model_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<Model[]>('/admin-settings?entity=models').then(r => setModels(r.data));
  }, []);

  const startCreate = () => {
    setForm({ slug: '', name: '', is_active: true, default_model_id: '' });
    setCreating(true); setEditing(null);
  };

  const startEdit = (p: Platform) => {
    setForm({ slug: p.slug, name: p.name, is_active: p.is_active, default_model_id: p.default_model_id || '' });
    setEditing(p.id); setCreating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, default_model_id: form.default_model_id || null };
      if (creating) { await create(payload as unknown as Partial<Platform>); setCreating(false); }
      else if (editing) { await update(editing, payload as unknown as Partial<Platform>); setEditing(null); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => { if (confirm(t('sa.confirmDelete'))) await remove(id); };

  // Get models for a platform
  const getModelsForPlatform = (platformId: string) => models.filter(m => m.platform_id === platformId);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />)}</div>;

  return (
    <div className="stagger-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Globe className="w-6 h-6 text-brand-primary" />{t('sa.platformsTitle')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.platformsSubtitle')}</p>
        </div>
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />{t('sa.addNew')}</button>
      </div>

      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{creating ? t('sa.addNew') : t('sa.editPlatform')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colSlug')}</label>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder={t('sa.slugPlaceholder')} className="input-field !py-2 !text-sm font-mono w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colName')}</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('sa.displayNamePlaceholder')} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colDefaultModel')}</label>
              <select value={form.default_model_id} onChange={e => setForm({ ...form, default_model_id: e.target.value })} className="input-field !py-2 !text-sm w-full">
                <option value="">—</option>
                {(editing ? getModelsForPlatform(editing) : models).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-primary" />{t('sa.active')}
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.slug || !form.name} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('sa.save')}
            </button>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="btn btn-secondary btn-sm"><X className="w-4 h-4" />{t('sa.cancel')}</button>
          </div>
        </div>
      )}

      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">{t('sa.colSlug')}</th>
              <th className="text-left">{t('sa.colName')}</th>
              <th className="text-left">{t('sa.colDefaultModel')}</th>
              <th className="text-center">{t('sa.colActive')}</th>
              <th className="text-center">{t('sa.relatedModels')}</th>
              <th className="text-left">{t('sa.colCreated')}</th>
              <th className="text-right">{t('sa.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {platforms.length === 0 ? (
              <tr><td colSpan={7} className="!text-center !font-body !text-text-secondary">{t('sa.noPlatforms')}</td></tr>
            ) : platforms.map(p => {
              const platformModels = getModelsForPlatform(p.id);
              const defaultModel = models.find(m => m.id === p.default_model_id);
              const isExpanded = expandedId === p.id;

              return (
                <Fragment key={p.id}>
                  <tr className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <td>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                        <code className="text-brand-primary font-semibold">{p.slug}</code>
                      </div>
                    </td>
                    <td className="!font-body font-medium">{p.name}</td>
                    <td className="!font-body text-sm">{defaultModel ? defaultModel.name : <span className="text-text-secondary italic">—</span>}</td>
                    <td className="text-center">
                      <button onClick={(e) => { e.stopPropagation(); update(p.id, { is_active: !p.is_active } as unknown as Partial<Platform>); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {p.is_active ? t('sa.active') : t('sa.inactive')}
                      </button>
                    </td>
                    <td className="text-center !font-body">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">{platformModels.length}</span>
                    </td>
                    <td className="!font-body text-sm">{formatDate(p.created_at)}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(p)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">ID</span><code className="text-xs text-text-primary break-all">{p.id}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.defaultModelIdLabel')}</span><code className="text-xs text-text-primary break-all">{p.default_model_id || '—'}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.colUpdated')}</span><span className="text-text-primary">{p.updated_at ? formatDateTime(p.updated_at, 'dateTime') : '—'}</span></div>
                        </div>
                        {platformModels.length > 0 && (
                          <div className="mt-3">
                            <span className="text-xs font-semibold text-text-secondary block mb-2">{t('sa.relatedModels')} ({platformModels.length})</span>
                            <div className="flex flex-wrap gap-2">
                              {platformModels.map(m => (
                                <span key={m.id} className="px-2 py-1 rounded bg-glass-bg border border-glass-border text-xs text-text-primary font-mono">{m.slug}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
