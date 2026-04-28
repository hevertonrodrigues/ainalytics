import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { TICKER_TEMPLATE } from './templates';
import { type BlogTickerItem, LANGS, type Lang } from './types';
import { useDialog } from '@/contexts/DialogContext';

interface FormState {
  lang: Lang; position: number; engine_id: string; label: string;
  value: string; trend: 'up' | 'down' | 'neutral'; link_url: string; is_active: boolean;
}

const EMPTY: FormState = {
  lang: 'pt', position: 1, engine_id: '', label: '', value: '', trend: 'neutral', link_url: '', is_active: true,
};

export function BlogTickerPage() {
  const { t } = useTranslation();
  const { alert, confirm } = useDialog();
  const [langFilter, setLangFilter] = useState<Lang | ''>('');
  const { data, isLoading, refetch, remove } = useBlogAdmin<BlogTickerItem>('ticker', { query: { lang: langFilter || undefined } });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const startCreate = () => { setForm(EMPTY); setCreating(true); setEditing(null); };

  const startEdit = (it: BlogTickerItem) => {
    setForm({
      lang: it.lang, position: it.position, engine_id: it.engine_id || '',
      label: it.label, value: it.value, trend: it.trend, link_url: it.link_url || '', is_active: it.is_active,
    });
    setEditing(it.id); setCreating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        lang: form.lang, position: form.position, engine_id: form.engine_id || null,
        label: form.label, value: form.value, trend: form.trend,
        link_url: form.link_url || null, is_active: form.is_active,
      };
      if (creating) await blogAdmin.create('ticker', payload);
      else if (editing !== null) await blogAdmin.update('ticker', editing, payload);
      setCreating(false); setEditing(null);
      refetch();
    } catch (err) {
      void alert({ message: `Save failed: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm({ message: t('sa.blog.confirmDelete'), variant: 'danger' }))) return;
    await remove(id);
  };

  if (isLoading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.ticker.title')}
        subtitle={t('sa.blog.modules.ticker.description')}
        icon={<Radio className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={TICKER_TEMPLATE} filename="ticker-template.json" />
        <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />{t('sa.blog.add')}
        </button>
      </SAPageHeader>

      <div className="dashboard-card p-3">
        <select value={langFilter} onChange={(e) => setLangFilter(e.target.value as Lang | '')} className="input-field !py-2 !text-sm">
          <option value="">{t('sa.blog.allLanguages')}</option>
          {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>

      {(creating || editing !== null) && (
        <div className="dashboard-card p-5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value as Lang })} className="input-field !py-2 !text-sm">
              {LANGS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </select>
            <input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} placeholder="position" className="input-field !py-2 !text-sm w-full" />
            <input value={form.engine_id} onChange={(e) => setForm({ ...form, engine_id: e.target.value })} placeholder="engine_id (or 'multi')" className="input-field !py-2 !text-sm w-full" />
            <select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value as 'up' | 'down' | 'neutral' })} className="input-field !py-2 !text-sm">
              <option value="up">up</option>
              <option value="neutral">neutral</option>
              <option value="down">down</option>
            </select>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="label" className="input-field !py-2 !text-sm w-full" />
            <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="value" className="input-field !py-2 !text-sm w-full sm:col-span-2" />
            <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="link_url" className="input-field !py-2 !text-sm w-full sm:col-span-3" />
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-primary" />active
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
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
              <th>lang</th>
              <th>pos</th>
              <th>engine</th>
              <th>label</th>
              <th>value</th>
              <th>trend</th>
              <th>active</th>
              <th className="text-right">actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((it) => (
              <tr key={it.id}>
                <td className="font-mono text-xs uppercase">{it.lang}</td>
                <td>{it.position}</td>
                <td className="text-xs">{it.engine_id || '—'}</td>
                <td className="text-xs font-semibold">{it.label}</td>
                <td className="text-xs">{it.value}</td>
                <td>{it.trend}</td>
                <td>{it.is_active ? '✓' : ''}</td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(it)} className="icon-btn"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(it.id)} className="icon-btn text-error/70 hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
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
