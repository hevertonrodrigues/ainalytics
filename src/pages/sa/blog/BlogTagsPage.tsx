import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tags as TagsIcon, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { TAGS_TEMPLATE } from './templates';
import { type BlogTag, LANGS, type Lang } from './types';
import { useDialog } from '@/contexts/DialogContext';

interface FormState {
  id: string; is_engine: boolean;
  pt_slug: string; pt_label: string;
  es_slug: string; es_label: string;
  en_slug: string; en_label: string;
}

const EMPTY: FormState = {
  id: '', is_engine: false,
  pt_slug: '', pt_label: '', es_slug: '', es_label: '', en_slug: '', en_label: '',
};

export function BlogTagsPage() {
  const { t } = useTranslation();
  const { alert, confirm } = useDialog();
  const { data, isLoading, refetch, remove } = useBlogAdmin<BlogTag>('tags');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const startCreate = () => { setForm(EMPTY); setCreating(true); setEditing(null); };

  const startEdit = (tg: BlogTag) => {
    blogAdmin.one<BlogTag>('tags', tg.id).then((res) => {
      const trs = (res.data as unknown as { translations: Array<{ lang: Lang; slug: string; label: string }> }).translations || [];
      const map: Record<Lang, { slug: string; label: string }> = {
        pt: { slug: '', label: '' }, es: { slug: '', label: '' }, en: { slug: '', label: '' },
      };
      for (const tr of trs) map[tr.lang] = tr;
      setForm({
        id: tg.id, is_engine: tg.is_engine,
        pt_slug: map.pt.slug, pt_label: map.pt.label,
        es_slug: map.es.slug, es_label: map.es.label,
        en_slug: map.en.slug, en_label: map.en.label,
      });
      setEditing(tg.id); setCreating(false);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tag: { id: form.id, is_engine: form.is_engine },
        translations: {
          pt: { slug: form.pt_slug, label: form.pt_label },
          es: { slug: form.es_slug, label: form.es_label },
          en: { slug: form.en_slug, label: form.en_label },
        },
      };
      if (creating) await blogAdmin.create('tags', payload);
      else if (editing) await blogAdmin.update('tags', editing, payload);
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
        title={t('sa.blog.modules.tags.title')}
        subtitle={t('sa.blog.modules.tags.description')}
        icon={<TagsIcon className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={TAGS_TEMPLATE} filename="tags-template.json" />
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.add')}
        </button>
      </SAPageHeader>

      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">{creating ? t('sa.blog.add') : t('sa.blog.edit')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">id</label>
              <input value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} className="input-field !py-2 !text-sm w-full font-mono" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.is_engine} onChange={(e) => setForm({ ...form, is_engine: e.target.checked })} className="accent-brand-primary" />is_engine
              </label>
            </div>
          </div>
          {LANGS.map((lang) => (
            <div key={lang} className="grid grid-cols-2 gap-3 border-t border-glass-border pt-3">
              <div className="col-span-2 text-xs font-semibold text-text-secondary uppercase">{lang}</div>
              <input
                value={form[`${lang}_slug` as keyof FormState] as string}
                onChange={(e) => setForm({ ...form, [`${lang}_slug`]: e.target.value })}
                placeholder="slug"
                className="input-field !py-2 !text-sm w-full"
              />
              <input
                value={form[`${lang}_label` as keyof FormState] as string}
                onChange={(e) => setForm({ ...form, [`${lang}_label`]: e.target.value })}
                placeholder="label"
                className="input-field !py-2 !text-sm w-full"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving || !form.id} className="btn btn-primary btn-sm">
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
              <th className="text-left">id</th>
              <th className="text-center">is_engine</th>
              <th className="text-left">labels</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tg) => (
              <tr key={tg.id}>
                <td className="!font-body font-semibold">{tg.id}</td>
                <td className="text-center">{tg.is_engine ? '✓' : ''}</td>
                <td className="text-xs">
                  {tg.labels && Object.entries(tg.labels).map(([l, v]) => `${l}:${v}`).join(' · ')}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(tg)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(tg.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
