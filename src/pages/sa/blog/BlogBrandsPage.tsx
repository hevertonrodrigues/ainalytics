import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { BRANDS_TEMPLATE } from './templates';
import { EDGE_FUNCTION_BASE } from '@/lib/constants';
import type { BlogBrand } from './types';

interface SectorOpt { id: string; label: string }
interface SubsectorOpt { id: string; label: string; sector_id: string }

interface FormState {
  id: string; name: string; country: string;
  sector: string; subsector_id: string;
  homepage_domain: string; entity_type: string;
  pt_label: string; es_label: string; en_label: string;
}

const EMPTY: FormState = {
  id: '', name: '', country: 'BR',
  sector: 'financial-services', subsector_id: '',
  homepage_domain: '', entity_type: 'company',
  pt_label: '', es_label: '', en_label: '',
};

const ENTITY_TYPES = ['company', 'university', 'school', 'hospital', 'government', 'nonprofit', 'brand'];

export function BlogBrandsPage() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, remove } = useBlogAdmin<BlogBrand>('brands');
  const [sectors, setSectors] = useState<SectorOpt[]>([]);
  const [subsectors, setSubsectors] = useState<SubsectorOpt[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Pull the sector + subsector taxonomy from the public ranking-sectors endpoint
    fetch(`${EDGE_FUNCTION_BASE}/blog-ranking-sectors/en`).then(async (res) => {
      if (!res.ok) return;
      const json = await res.json();
      const items = json?.data?.items || [];
      setSectors(items.map((s: { id: string; label: string }) => ({ id: s.id, label: s.label })));
      const subs: SubsectorOpt[] = [];
      for (const s of items as Array<{ id: string; label: string; subsectors: Array<{ id: string; label: string }> }>) {
        for (const sub of s.subsectors || []) subs.push({ id: sub.id, label: `${s.label} · ${sub.label}`, sector_id: s.id });
      }
      setSubsectors(subs);
    }).catch(() => undefined);
  }, []);

  const startCreate = () => { setForm(EMPTY); setCreating(true); setEditing(null); };

  const startEdit = (b: BlogBrand) => {
    setForm({
      id: b.id, name: b.name, country: b.country || '',
      sector: b.sector,
      subsector_id: (b as BlogBrand & { subsector_id?: string | null }).subsector_id || '',
      homepage_domain: (b as BlogBrand & { homepage_domain?: string | null }).homepage_domain || '',
      entity_type: (b as BlogBrand & { entity_type?: string }).entity_type || 'company',
      pt_label: b.labels?.pt || '', es_label: b.labels?.es || '', en_label: b.labels?.en || '',
    });
    setEditing(b.id); setCreating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: form.id, name: form.name, country: form.country || null,
        sector: form.sector,
        subsector_id: form.subsector_id || null,
        homepage_domain: form.homepage_domain || null,
        entity_type: form.entity_type,
        labels: { pt: form.pt_label, es: form.es_label, en: form.en_label },
      };
      if (creating) await blogAdmin.create('brands', payload);
      else if (editing) await blogAdmin.update('brands', editing, payload);
      setCreating(false); setEditing(null);
      refetch();
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('sa.blog.confirmDelete'))) return;
    await remove(id);
  };

  if (isLoading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  // Filter subsectors by selected sector for the form dropdown
  const filteredSubsectors = subsectors.filter((s) => s.sector_id === form.sector);

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.brands.title')}
        subtitle={t('sa.blog.modules.brands.description')}
        icon={<Building2 className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={BRANDS_TEMPLATE} filename="brands-template.json" />
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.add')}
        </button>
      </SAPageHeader>

      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="id (slug)" className="input-field !py-2 !text-sm w-full font-mono" />
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="name" className="input-field !py-2 !text-sm w-full" />
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 6) })} placeholder="country (BR/ES/US/GLOBAL)" className="input-field !py-2 !text-sm w-full font-mono" />
            <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })} className="input-field !py-2 !text-sm w-full">
              {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
            </select>
            <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value, subsector_id: '' })} className="input-field !py-2 !text-sm w-full">
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={form.subsector_id} onChange={(e) => setForm({ ...form, subsector_id: e.target.value })} className="input-field !py-2 !text-sm w-full">
              <option value="">— {t('sa.blog.brands.noSubsector')} —</option>
              {filteredSubsectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input value={form.homepage_domain} onChange={(e) => setForm({ ...form, homepage_domain: e.target.value })} placeholder="homepage_domain (e.g. nubank.com.br)" className="input-field !py-2 !text-sm w-full sm:col-span-2 font-mono" />
            <input value={form.pt_label} onChange={(e) => setForm({ ...form, pt_label: e.target.value })} placeholder="pt label" className="input-field !py-2 !text-sm w-full" />
            <input value={form.es_label} onChange={(e) => setForm({ ...form, es_label: e.target.value })} placeholder="es label" className="input-field !py-2 !text-sm w-full" />
            <input value={form.en_label} onChange={(e) => setForm({ ...form, en_label: e.target.value })} placeholder="en label" className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.id || !form.name} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('sa.blog.save')}
            </button>
            <button onClick={() => { setCreating(false); setEditing(null); }} className="btn btn-secondary btn-sm">
              <X className="w-4 h-4" />{t('sa.blog.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th>country</th>
              <th>sector</th>
              <th>subsector</th>
              <th>type</th>
              <th>domain</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b) => {
              const ext = b as BlogBrand & { subsector_id?: string | null; homepage_domain?: string | null; entity_type?: string };
              return (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.id}</td>
                  <td className="font-semibold">{b.name}</td>
                  <td>{b.country || '—'}</td>
                  <td className="text-xs">{b.sector}</td>
                  <td className="text-xs">{ext.subsector_id || '—'}</td>
                  <td className="text-xs">{ext.entity_type || 'company'}</td>
                  <td className="text-xs font-mono">{ext.homepage_domain || '—'}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(b)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(b.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
