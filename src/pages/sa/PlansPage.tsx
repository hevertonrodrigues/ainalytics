import { useState, Fragment } from 'react';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Pencil, Trash2, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminCrud } from './useAdminCrud';

interface Plan {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  sort_order: number;
  settings: Record<string, unknown>;
  features: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const { data: plans, isLoading, create, update, remove } = useAdminCrud<Plan>('plans');
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', price: '0', sort_order: '0', is_active: true,
    max_prompts: '3', refresh_rate: 'monthly', custom_pricing: false,
    description_en: '', description_es: '', description_pt: '',
    features_en: '', features_es: '', features_pt: '',
  });
  const [saving, setSaving] = useState(false);

  const lang = i18n.language === 'es' ? 'es' : i18n.language === 'pt-BR' ? 'pt-br' : 'en';

  const startCreate = () => {
    setForm({
      name: '', price: '0', sort_order: '0', is_active: true,
      max_prompts: '3', refresh_rate: 'monthly', custom_pricing: false,
      description_en: '', description_es: '', description_pt: '',
      features_en: '', features_es: '', features_pt: '',
    });
    setCreating(true); setEditing(null);
  };

  const startEdit = (p: Plan) => {
    const s = p.settings as Record<string, unknown>;
    const desc = (s.description || {}) as Record<string, string>;
    const f = p.features as Record<string, string[]>;
    setForm({
      name: p.name, price: String(p.price), sort_order: String(p.sort_order), is_active: p.is_active,
      max_prompts: String(s.max_prompts || ''),
      refresh_rate: String(s.refresh_rate || 'monthly'),
      custom_pricing: Boolean(s.custom_pricing),
      description_en: desc.en || '', description_es: desc.es || '', description_pt: desc['pt-br'] || '',
      features_en: (f.en || []).join('\n'), features_es: (f.es || []).join('\n'), features_pt: (f['pt-br'] || []).join('\n'),
    });
    setEditing(p.id); setCreating(false);
  };

  const buildPayload = () => ({
    name: form.name,
    price: Number(form.price),
    sort_order: Number(form.sort_order),
    is_active: form.is_active,
    settings: {
      max_prompts: form.max_prompts ? Number(form.max_prompts) : undefined,
      refresh_rate: form.refresh_rate,
      custom_pricing: form.custom_pricing || undefined,
      description: {
        en: form.description_en, es: form.description_es, 'pt-br': form.description_pt,
      },
    },
    features: {
      en: form.features_en.split('\n').filter(Boolean),
      es: form.features_es.split('\n').filter(Boolean),
      'pt-br': form.features_pt.split('\n').filter(Boolean),
    },
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (creating) { await create(payload as unknown as Partial<Plan>); setCreating(false); }
      else if (editing) { await update(editing, payload as unknown as Partial<Plan>); setEditing(null); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => { if (confirm(t('sa.confirmDelete'))) await remove(id); };

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />)}</div>;

  return (
    <div className="stagger-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2"><Package className="w-6 h-6 text-brand-primary" />{t('sa.plansTitle')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.plansSubtitle')}</p>
        </div>
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" />{t('sa.addNew')}</button>
      </div>

      {/* Create / Edit form */}
      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{creating ? t('sa.addNew') : t('sa.editPlan')}</h3>
          {/* Row 1: Basic fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colName')}</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colPrice')}</label>
              <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} type="number" className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colMaxPrompts')}</label>
              <input value={form.max_prompts} onChange={e => setForm({ ...form, max_prompts: e.target.value })} type="number" className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colRefreshRate')}</label>
              <select value={form.refresh_rate} onChange={e => setForm({ ...form, refresh_rate: e.target.value })} className="input-field !py-2 !text-sm w-full">
                <option value="monthly">{t('sa.monthly')}</option><option value="weekly">{t('sa.weekly')}</option><option value="daily">{t('sa.daily')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.colOrder')}</label>
              <input value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} type="number" className="input-field !py-2 !text-sm w-full" />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-primary" />{t('sa.active')}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                <input type="checkbox" checked={form.custom_pricing} onChange={e => setForm({ ...form, custom_pricing: e.target.checked })} className="accent-brand-primary" />{t('sa.customPricing')}
              </label>
            </div>
          </div>
          {/* Row 2: Descriptions */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.descriptions')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-text-muted">EN</span>
                <textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} rows={2} className="input-field !py-2 !text-xs w-full resize-none" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">ES</span>
                <textarea value={form.description_es} onChange={e => setForm({ ...form, description_es: e.target.value })} rows={2} className="input-field !py-2 !text-xs w-full resize-none" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">PT-BR</span>
                <textarea value={form.description_pt} onChange={e => setForm({ ...form, description_pt: e.target.value })} rows={2} className="input-field !py-2 !text-xs w-full resize-none" />
              </div>
            </div>
          </div>
          {/* Row 3: Features */}
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">{t('sa.features')} <span className="text-text-muted">({t('sa.onePerLine')})</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-text-muted">EN</span>
                <textarea value={form.features_en} onChange={e => setForm({ ...form, features_en: e.target.value })} rows={4} className="input-field !py-2 !text-xs font-mono w-full resize-none" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">ES</span>
                <textarea value={form.features_es} onChange={e => setForm({ ...form, features_es: e.target.value })} rows={4} className="input-field !py-2 !text-xs font-mono w-full resize-none" />
              </div>
              <div>
                <span className="text-[10px] text-text-muted">PT-BR</span>
                <textarea value={form.features_pt} onChange={e => setForm({ ...form, features_pt: e.target.value })} rows={4} className="input-field !py-2 !text-xs font-mono w-full resize-none" />
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.name} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('sa.save')}
            </button>
            <button onClick={() => { setEditing(null); setCreating(false); }} className="btn btn-secondary btn-sm">
              <X className="w-4 h-4" />{t('sa.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">{t('sa.colName')}</th>
              <th className="text-right">{t('sa.colPrice')}</th>
              <th className="text-center">{t('sa.colMaxPrompts')}</th>
              <th className="text-center hidden md:table-cell">{t('sa.colRefreshRate')}</th>
              <th className="text-center hidden md:table-cell">{t('sa.colOrder')}</th>
              <th className="text-center">{t('sa.colActive')}</th>
              <th className="text-center hidden md:table-cell">{t('sa.colCreated')}</th>
              <th className="text-right">{t('sa.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => {
              const s = p.settings as Record<string, unknown>;
              const desc = (s.description || {}) as Record<string, string>;
              const f = p.features as Record<string, string[]>;
              const featureList = f[lang] || f.en || [];
              const description = desc[lang] || desc.en || '';
              const isExpanded = expandedId === p.id;

              return (
                <Fragment key={p.id}>
                  <tr className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <td className="!font-body font-semibold">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />}
                        {p.name}
                      </div>
                    </td>
                    <td className="text-right">{s.custom_pricing ? t('sa.customPricing') : `$${Number(p.price).toFixed(0)}`}</td>
                    <td className="text-center">{s.max_prompts ? String(s.max_prompts) : '∞'}</td>
                    <td className="text-center capitalize hidden md:table-cell">{String(s.refresh_rate || '—')}</td>
                    <td className="text-center hidden md:table-cell">{p.sort_order}</td>
                    <td className="text-center">
                      <button onClick={(e) => { e.stopPropagation(); update(p.id, { is_active: !p.is_active } as unknown as Partial<Plan>); }}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {p.is_active ? t('sa.active') : t('sa.inactive')}
                      </button>
                    </td>
                    <td className="text-center text-xs hidden md:table-cell">{formatDate(p.created_at)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEdit(p)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.description')}</span>
                            <p className="text-sm text-text-primary">{description || <span className="text-text-muted italic">—</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.features')}</span>
                            {featureList.length > 0 ? (
                              <ul className="text-sm text-text-primary list-disc list-inside space-y-0.5">
                                {featureList.map((f, i) => <li key={i}>{f}</li>)}
                              </ul>
                            ) : <span className="text-text-muted italic text-sm">—</span>}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-text-secondary block mb-1">ID</span>
                            <code className="text-xs text-text-primary font-mono">{p.id}</code>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.colUpdated')}</span>
                            <span className="text-sm text-text-primary">{formatDateTime(p.updated_at, 'dateTime')}</span>
                          </div>
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
