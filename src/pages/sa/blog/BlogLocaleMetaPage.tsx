import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Save, Loader2 } from 'lucide-react';
import { blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { LOCALE_META_TEMPLATE } from './templates';
import { LANGS, type Lang, type LocaleMeta } from './types';

export function BlogLocaleMetaPage() {
  const { t } = useTranslation();
  const [activeLang, setActiveLang] = useState<Lang>('pt');
  const [allMeta, setAllMeta] = useState<Record<Lang, LocaleMeta | null>>({ pt: null, es: null, en: null });
  const [meta, setMeta] = useState<LocaleMeta | null>(null);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    blogAdmin.list<LocaleMeta>('locale_meta')
      .then((res) => {
        const map: Record<Lang, LocaleMeta | null> = { pt: null, es: null, en: null };
        for (const r of res.data) map[r.lang] = r;
        setAllMeta(map);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const m = allMeta[activeLang];
    setMeta(m);
    setKeywordsInput((m?.site_keywords || []).join(', '));
  }, [activeLang, allMeta]);

  const handleSave = async () => {
    if (!meta) return;
    setSaving(true);
    try {
      const payload = {
        ...meta,
        lang: activeLang,
        site_keywords: keywordsInput.split(',').map((k) => k.trim()).filter(Boolean),
      };
      const res = await blogAdmin.create<LocaleMeta>('locale_meta', payload);
      setAllMeta({ ...allMeta, [activeLang]: res.data });
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<LocaleMeta>) => meta && setMeta({ ...meta, ...patch });

  if (loading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.localeMeta.title')}
        subtitle={t('sa.blog.modules.localeMeta.description')}
        icon={<Globe className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={LOCALE_META_TEMPLATE} filename="locale-meta-template.json" />
        <button onClick={handleSave} disabled={saving || !meta} className="btn btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('sa.blog.save')}
        </button>
      </SAPageHeader>

      <div className="dashboard-card p-3 flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setActiveLang(l)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${activeLang === l ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-glass-hover'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {!meta ? (
        <div className="dashboard-card p-10 text-center text-text-muted">{t('sa.blog.localeMeta.missing', { lang: activeLang })}</div>
      ) : (
        <>
          <Section title={t('sa.blog.localeMeta.siteSection')}>
            <Field label="site_title" value={meta.site_title} onChange={(v) => update({ site_title: v })} />
            <Field label="site_description" value={meta.site_description} onChange={(v) => update({ site_description: v })} multiline />
            <Field label="site_keywords (comma-separated)" value={keywordsInput} onChange={setKeywordsInput} multiline />
            <Field label="default_og_image_url" value={meta.default_og_image_url || ''} onChange={(v) => update({ default_og_image_url: v || null })} />
            <Field label="twitter_handle" value={meta.twitter_handle || ''} onChange={(v) => update({ twitter_handle: v || null })} />
            <Field label="category_segment (URL prefix)" value={meta.category_segment} onChange={(v) => update({ category_segment: v })} />
          </Section>

          <Section title={t('sa.blog.localeMeta.publisherSection')}>
            <Field label="publisher_name" value={meta.publisher_name} onChange={(v) => update({ publisher_name: v })} />
            <Field label="publisher_url" value={meta.publisher_url} onChange={(v) => update({ publisher_url: v })} />
            <Field label="publisher_logo_url" value={meta.publisher_logo_url} onChange={(v) => update({ publisher_logo_url: v })} />
            <NumberField label="publisher_logo_width" value={meta.publisher_logo_width} onChange={(v) => update({ publisher_logo_width: v })} />
            <NumberField label="publisher_logo_height" value={meta.publisher_logo_height} onChange={(v) => update({ publisher_logo_height: v })} />
          </Section>

          <Section title={t('sa.blog.localeMeta.trendingSection')}>
            <Field label="trending_eyebrow" value={meta.trending_eyebrow || ''} onChange={(v) => update({ trending_eyebrow: v || null })} />
            <Field label="trending_title" value={meta.trending_title} onChange={(v) => update({ trending_title: v })} />
            <Field label="trending_description" value={meta.trending_description} onChange={(v) => update({ trending_description: v })} multiline />
          </Section>

          <Section title={t('sa.blog.localeMeta.rankingsSection')}>
            <Field label="rankings_title" value={meta.rankings_title} onChange={(v) => update({ rankings_title: v })} />
            <Field label="rankings_description" value={meta.rankings_description} onChange={(v) => update({ rankings_description: v })} multiline />
          </Section>

          <Section title={t('sa.blog.localeMeta.categoriesSection')}>
            <Field label="categories_title" value={meta.categories_title} onChange={(v) => update({ categories_title: v })} />
            <Field label="categories_description" value={meta.categories_description} onChange={(v) => update({ categories_description: v })} multiline />
          </Section>

          <Section title={t('sa.blog.localeMeta.newsletterSection')}>
            <Field label="newsletter_eyebrow" value={meta.newsletter_eyebrow || ''} onChange={(v) => update({ newsletter_eyebrow: v || null })} />
            <Field label="newsletter_title" value={meta.newsletter_title || ''} onChange={(v) => update({ newsletter_title: v || null })} />
            <Field label="newsletter_text" value={meta.newsletter_text || ''} onChange={(v) => update({ newsletter_text: v || null })} multiline />
            <Field label="newsletter_placeholder" value={meta.newsletter_placeholder || ''} onChange={(v) => update({ newsletter_placeholder: v || null })} />
            <Field label="newsletter_button" value={meta.newsletter_button || ''} onChange={(v) => update({ newsletter_button: v || null })} />
            <Field label="newsletter_success_message" value={meta.newsletter_success_message || ''} onChange={(v) => update({ newsletter_success_message: v || null })} multiline />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dashboard-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div className={multiline ? 'sm:col-span-2' : ''}>
      <label className="text-xs text-text-secondary block mb-1">{label}</label>
      {multiline
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="input-field !py-2 !text-sm w-full resize-none" />
        : <input value={value} onChange={(e) => onChange(e.target.value)} className="input-field !py-2 !text-sm w-full" />}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-text-secondary block mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="input-field !py-2 !text-sm w-full" />
    </div>
  );
}
