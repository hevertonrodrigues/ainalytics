import { useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderTree, Plus, Pencil, Trash2, Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { CATEGORIES_TEMPLATE } from './templates';
import { type BlogCategory, LANGS, type Lang } from './types';
import { useDialog } from '@/contexts/DialogContext';

interface FormState {
  id: string;
  position: number;
  is_active: boolean;
  pt_slug: string; pt_label: string; pt_desc: string; pt_seo: string;
  es_slug: string; es_label: string; es_desc: string; es_seo: string;
  en_slug: string; en_label: string; en_desc: string; en_seo: string;
}

const EMPTY: FormState = {
  id: '', position: 0, is_active: true,
  pt_slug: '', pt_label: '', pt_desc: '', pt_seo: '',
  es_slug: '', es_label: '', es_desc: '', es_seo: '',
  en_slug: '', en_label: '', en_desc: '', en_seo: '',
};

export function BlogCategoriesPage() {
  const { t } = useTranslation();
  const { alert, confirm } = useDialog();
  const { data, isLoading, refetch, remove } = useBlogAdmin<BlogCategory>('categories');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const startCreate = () => { setForm(EMPTY); setCreating(true); setEditing(null); };

  const startEdit = (c: BlogCategory) => {
    blogAdmin.one<BlogCategory>('categories', c.id).then((res) => {
      const trs = (res.data as unknown as { translations: Array<{ lang: Lang; slug: string; label: string; description: string; seo_title: string | null }> }).translations || [];
      const map: Record<Lang, { slug: string; label: string; description: string; seo_title: string | null }> = {
        pt: { slug: '', label: '', description: '', seo_title: null },
        es: { slug: '', label: '', description: '', seo_title: null },
        en: { slug: '', label: '', description: '', seo_title: null },
      };
      for (const tr of trs) map[tr.lang as Lang] = tr;
      setForm({
        id: c.id, position: c.position, is_active: c.is_active,
        pt_slug: map.pt.slug, pt_label: map.pt.label, pt_desc: map.pt.description, pt_seo: map.pt.seo_title || '',
        es_slug: map.es.slug, es_label: map.es.label, es_desc: map.es.description, es_seo: map.es.seo_title || '',
        en_slug: map.en.slug, en_label: map.en.label, en_desc: map.en.description, en_seo: map.en.seo_title || '',
      });
      setEditing(c.id); setCreating(false);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        category: { id: form.id, position: form.position, is_active: form.is_active },
        translations: {
          pt: { slug: form.pt_slug, label: form.pt_label, description: form.pt_desc, seo_title: form.pt_seo, segment: 'categoria' },
          es: { slug: form.es_slug, label: form.es_label, description: form.es_desc, seo_title: form.es_seo, segment: 'categoria' },
          en: { slug: form.en_slug, label: form.en_label, description: form.en_desc, seo_title: form.en_seo, segment: 'category' },
        },
      };
      if (creating) await blogAdmin.create('categories', payload);
      else if (editing) await blogAdmin.update('categories', editing, payload);
      setCreating(false); setEditing(null);
      refetch();
    } catch (err) {
      void alert({ message: `Save failed: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: t('sa.blog.confirmDelete'), variant: 'danger' }))) return;
    await remove(id);
  };

  if (isLoading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.categories.title')}
        subtitle={t('sa.blog.modules.categories.description')}
        icon={<FolderTree className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={CATEGORIES_TEMPLATE} filename="categories-template.json" />
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.add')}
        </button>
      </SAPageHeader>

      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{creating ? t('sa.blog.add') : t('sa.blog.edit')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-text-secondary block mb-1">id</label>
              <input value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} className="input-field !py-2 !text-sm w-full font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary block mb-1">position</label>
              <input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-primary" />active
              </label>
            </div>
          </div>

          {LANGS.map((lang) => {
            const slugKey = `${lang}_slug` as keyof FormState;
            const labelKey = `${lang}_label` as keyof FormState;
            const descKey = `${lang}_desc` as keyof FormState;
            const seoKey = `${lang}_seo` as keyof FormState;
            return (
              <div key={lang} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-glass-border pt-3">
                <div className="sm:col-span-2 text-xs font-semibold text-text-secondary uppercase">{lang}</div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">slug</label>
                  <input value={form[slugKey] as string} onChange={(e) => setForm({ ...form, [slugKey]: e.target.value })} className="input-field !py-2 !text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">label</label>
                  <input value={form[labelKey] as string} onChange={(e) => setForm({ ...form, [labelKey]: e.target.value })} className="input-field !py-2 !text-sm w-full" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted block mb-1">description</label>
                  <textarea value={form[descKey] as string} rows={2} onChange={(e) => setForm({ ...form, [descKey]: e.target.value })} className="input-field !py-2 !text-sm w-full resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-text-muted block mb-1">seo_title</label>
                  <input value={form[seoKey] as string} onChange={(e) => setForm({ ...form, [seoKey]: e.target.value })} className="input-field !py-2 !text-sm w-full" />
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.id} className="btn btn-primary btn-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('sa.blog.save')}
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
              <th className="text-left">id</th>
              <th className="text-center">position</th>
              <th className="text-center">active</th>
              <th className="text-left hidden md:table-cell">labels</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => {
              const isExp = expanded === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className="cursor-pointer" onClick={() => setExpanded(isExp ? null : c.id)}>
                    <td className="!font-body font-semibold">
                      <div className="flex items-center gap-2">
                        {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {c.id}
                      </div>
                    </td>
                    <td className="text-center">{c.position}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                        {c.is_active ? 'yes' : 'no'}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-xs">
                      {c.labels && Object.entries(c.labels).map(([l, v]) => `${l}:${v.label}`).join(' · ')}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => startEdit(c)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(c.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
