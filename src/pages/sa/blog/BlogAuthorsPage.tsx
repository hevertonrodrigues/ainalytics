import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { AUTHORS_TEMPLATE } from './templates';
import { type BlogAuthor, LANGS, type Lang } from './types';
import { useDialog } from '@/contexts/DialogContext';

interface FormState {
  id: string; email: string; image_url: string;
  social_x: string; social_linkedin: string; social_email: string;
  pt_name: string; pt_role: string; pt_bio: string;
  es_name: string; es_role: string; es_bio: string;
  en_name: string; en_role: string; en_bio: string;
}

const EMPTY: FormState = {
  id: '', email: '', image_url: '',
  social_x: '', social_linkedin: '', social_email: '',
  pt_name: '', pt_role: '', pt_bio: '',
  es_name: '', es_role: '', es_bio: '',
  en_name: '', en_role: '', en_bio: '',
};

export function BlogAuthorsPage() {
  const { t } = useTranslation();
  const { alert, confirm } = useDialog();
  const { data, isLoading, refetch, remove } = useBlogAdmin<BlogAuthor>('authors');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const startCreate = () => { setForm(EMPTY); setCreating(true); setEditing(null); };

  const startEdit = (a: BlogAuthor) => {
    blogAdmin.one<BlogAuthor>('authors', a.id).then((res) => {
      const author = res.data;
      const trs = (author as unknown as { translations: Array<{ lang: Lang; name: string; role: string; bio?: string | null }> }).translations || [];
      const map: Record<Lang, { name: string; role: string; bio: string }> = {
        pt: { name: '', role: '', bio: '' }, es: { name: '', role: '', bio: '' }, en: { name: '', role: '', bio: '' },
      };
      for (const tr of trs) map[tr.lang] = { name: tr.name, role: tr.role, bio: tr.bio || '' };
      setForm({
        id: author.id, email: author.email || '', image_url: author.image_url || '',
        social_x: author.social?.x || '', social_linkedin: author.social?.linkedin || '', social_email: author.social?.email || '',
        pt_name: map.pt.name, pt_role: map.pt.role, pt_bio: map.pt.bio,
        es_name: map.es.name, es_role: map.es.role, es_bio: map.es.bio,
        en_name: map.en.name, en_role: map.en.role, en_bio: map.en.bio,
      });
      setEditing(a.id); setCreating(false);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const social: Record<string, string> = {};
      if (form.social_x) social.x = form.social_x;
      if (form.social_linkedin) social.linkedin = form.social_linkedin;
      if (form.social_email) social.email = form.social_email;
      const payload = {
        author: { id: form.id, email: form.email || null, image_url: form.image_url || null, social },
        translations: {
          pt: { name: form.pt_name, role: form.pt_role, bio: form.pt_bio },
          es: { name: form.es_name, role: form.es_role, bio: form.es_bio },
          en: { name: form.en_name, role: form.en_role, bio: form.en_bio },
        },
      };
      if (creating) await blogAdmin.create('authors', payload);
      else if (editing) await blogAdmin.update('authors', editing, payload);
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
        title={t('sa.blog.modules.authors.title')}
        subtitle={t('sa.blog.modules.authors.description')}
        icon={<Users className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={AUTHORS_TEMPLATE} filename="authors-template.json" />
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.add')}
        </button>
      </SAPageHeader>

      {(creating || editing) && (
        <div className="dashboard-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">{creating ? t('sa.blog.add') : t('sa.blog.edit')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-secondary block mb-1">id</label>
              <input value={form.id} disabled={!!editing} onChange={(e) => setForm({ ...form, id: e.target.value })} className="input-field !py-2 !text-sm w-full font-mono" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">image_url</label>
              <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">x</label>
              <input value={form.social_x} onChange={(e) => setForm({ ...form, social_x: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">linkedin</label>
              <input value={form.social_linkedin} onChange={(e) => setForm({ ...form, social_linkedin: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">contact email</label>
              <input value={form.social_email} onChange={(e) => setForm({ ...form, social_email: e.target.value })} className="input-field !py-2 !text-sm w-full" />
            </div>
          </div>
          {LANGS.map((lang) => (
            <div key={lang} className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-glass-border pt-3">
              <div className="sm:col-span-2 text-xs font-semibold text-text-secondary uppercase">{lang}</div>
              <input
                value={form[`${lang}_name` as keyof FormState] as string}
                onChange={(e) => setForm({ ...form, [`${lang}_name`]: e.target.value })}
                placeholder="name"
                className="input-field !py-2 !text-sm w-full"
              />
              <input
                value={form[`${lang}_role` as keyof FormState] as string}
                onChange={(e) => setForm({ ...form, [`${lang}_role`]: e.target.value })}
                placeholder="role"
                className="input-field !py-2 !text-sm w-full"
              />
              <textarea
                value={form[`${lang}_bio` as keyof FormState] as string}
                onChange={(e) => setForm({ ...form, [`${lang}_bio`]: e.target.value })}
                placeholder="bio"
                rows={2}
                className="input-field !py-2 !text-sm w-full sm:col-span-2 resize-none"
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
              <th>id</th>
              <th>name</th>
              <th>role</th>
              <th>email</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td className="!font-body font-semibold font-mono">{a.id}</td>
                <td>{a.name || '—'}</td>
                <td className="text-xs">{a.role || '—'}</td>
                <td className="text-xs">{a.email || '—'}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(a)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(a.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
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
