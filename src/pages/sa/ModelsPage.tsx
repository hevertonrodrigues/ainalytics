import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Plus, Pencil, Trash2, Check, X, Loader2, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminCrud } from './useAdminCrud';
import { apiClient } from '@/lib/api';

interface Model {
  id: string;
  platform_id: string;
  slug: string;
  name: string;
  is_default: boolean;
  web_search_active: boolean;
  created_at: string;
  platform_name?: string | null;
  platform_slug?: string | null;
}

interface Platform { id: string; name: string; slug: string; }

export function ModelsPage() {
  const { t } = useTranslation();
  const { data: models, isLoading, create, update, remove } = useAdminCrud<Model>('models');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ platform_id: '', slug: '', name: '', is_default: false, web_search_active: false });
  const [saving, setSaving] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('all');

  useEffect(() => {
    apiClient.get<Platform[]>('/admin-settings?entity=platforms').then(r => setPlatforms(r.data));
  }, []);

  const startCreate = () => {
    setForm({ platform_id: platforms[0]?.id || '', slug: '', name: '', is_default: false, web_search_active: false });
    setCreating(true); setEditing(null);
  };

  const startEdit = (m: Model) => {
    setForm({ platform_id: m.platform_id, slug: m.slug, name: m.name, is_default: m.is_default, web_search_active: m.web_search_active });
    setEditing(m.id); setCreating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) { await create(form as unknown as Partial<Model>); setCreating(false); }
      else if (editing) { await update(editing, form as unknown as Partial<Model>); setEditing(null); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => { if (confirm(t('sa.confirmDelete'))) await remove(id); };

  const filtered = filterPlatform === 'all' ? models : models.filter(m => m.platform_id === filterPlatform);

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />)}</div>;

  return (
    <div className="stagger-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Cpu className="w-6 h-6 text-brand-primary" />{t('sa.modelsTitle')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.modelsSubtitle')}</p>
        </div>
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />{t('sa.addNew')}</button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="input-field !py-2 !text-sm w-48">
          <option value="all">{t('sa.allPlatforms')}</option>
          {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-sm text-text-primary font-medium">{filtered.length} {t('sa.modelsCount')}</span>
      </div>

      {/* Create/Edit form */}
      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">{creating ? t('sa.addNew') : t('sa.editModel')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colPlatform')}</label>
              <select value={form.platform_id} onChange={e => setForm({ ...form, platform_id: e.target.value })} className="input-field !py-2 !text-sm w-full">
                {platforms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colSlug')}</label>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} placeholder={t('sa.modelSlugPlaceholder')} className="input-field !py-2 !text-sm font-mono w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colName')}</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('sa.displayNamePlaceholder')} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div className="flex items-end gap-4 pb-1 col-span-2 sm:col-span-1 lg:col-span-2">
              <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="accent-brand-primary" />{t('sa.colDefault')}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.web_search_active} onChange={e => setForm({ ...form, web_search_active: e.target.checked })} className="accent-brand-primary" />
                <Globe className="w-3 h-3" />{t('sa.colWebSearch')}
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

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">{t('sa.colPlatform')}</th>
              <th className="text-left">{t('sa.colSlug')}</th>
              <th className="text-left">{t('sa.colName')}</th>
              <th className="text-center">{t('sa.colDefault')}</th>
              <th className="text-center">{t('sa.colWebSearch')}</th>
              <th className="text-left">{t('sa.colCreated')}</th>
              <th className="text-right">{t('sa.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="!text-center !font-body !text-text-secondary">{t('sa.noModels')}</td></tr>
            ) : filtered.map(m => {
              const isExpanded = expandedId === m.id;
              return (
                <Fragment key={m.id}>
                  <tr className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                    <td className="!font-body">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-glass-bg border border-glass-border text-text-primary font-medium">{m.platform_name || m.platform_slug}</span>
                      </div>
                    </td>
                    <td><code className="text-brand-primary text-xs font-semibold">{m.slug}</code></td>
                    <td className="!font-body font-medium">{m.name}</td>
                    <td className="text-center">
                      <button onClick={(e) => { e.stopPropagation(); update(m.id, { is_default: !m.is_default } as unknown as Partial<Model>); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.is_default ? 'bg-brand-primary/15 text-brand-primary' : 'text-text-secondary'}`}>
                        {m.is_default ? `★ ${t('sa.defaultStar')}` : '—'}
                      </button>
                    </td>
                    <td className="text-center">
                      <button onClick={(e) => { e.stopPropagation(); update(m.id, { web_search_active: !m.web_search_active } as unknown as Partial<Model>); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${m.web_search_active ? 'bg-chart-cyan/15 text-chart-cyan' : 'text-text-secondary'}`}>
                        {m.web_search_active ? <><Globe className="w-3 h-3" /> {t('sa.webSearchOn')}</> : '—'}
                      </button>
                    </td>
                    <td className="!font-body text-sm">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(m)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(m.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.modelIdLabel')}</span><code className="text-xs text-text-primary break-all">{m.id}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.platformIdLabel')}</span><code className="text-xs text-text-primary break-all">{m.platform_id}</code></div>
                          <div><span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.colCreated')}</span><span className="text-text-primary">{new Date(m.created_at).toLocaleString()}</span></div>
                        </div>
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
