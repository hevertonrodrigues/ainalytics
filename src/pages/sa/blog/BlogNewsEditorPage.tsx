import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Newspaper, Save, Loader2, Trash2, ChevronLeft, Plus, ExternalLink, Wand2 } from 'lucide-react';
import { blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { RichTextEditor } from '@/components/RichTextEditor';
import { forceConvertJsonBody, normalizeBody } from './bodyConversion';
import {
  type BlogArticle, type ArticleTranslation, type ArticleStatus,
  type Lang, LANGS, type BlogCategory, type BlogTag, type BlogAuthor,
} from './types';

const EMPTY_TRANSLATION: ArticleTranslation = {
  slug: '',
  title: '',
  dek: '',
  display_date: '',
  read_time_label: '',
  body: '',
  toc: [],
  ui: {},
  sidebar_cta: {},
  image_alt: null,
  meta_keywords: [],
};

export function BlogNewsEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: articleId } = useParams<{ id: string }>();
  const isNew = !articleId || articleId === 'new';

  const [article, setArticle] = useState<BlogArticle>({
    id: '',
    category_id: 'research',
    read_time_minutes: 5,
    image_url: null,
    image_width: null,
    image_height: null,
    status: 'draft',
    is_featured: false,
    trending_position: null,
    published_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    created_at: '',
    updated_at: '',
    translations: { pt: { ...EMPTY_TRANSLATION }, es: { ...EMPTY_TRANSLATION }, en: { ...EMPTY_TRANSLATION } },
    authors: [],
    tags: [],
    keywords: [],
    sources: [],
  });
  const [activeLang, setActiveLang] = useState<Lang>('pt');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [keywordsInput, setKeywordsInput] = useState('');

  useEffect(() => {
    Promise.all([
      blogAdmin.list<BlogCategory>('categories'),
      blogAdmin.list<BlogTag>('tags'),
      blogAdmin.list<BlogAuthor>('authors'),
    ]).then(([c, t, a]) => {
      setCategories(c.data);
      setTags(t.data);
      setAuthors(a.data);
    }).catch((err) => console.error('Failed to load lookups', err));
  }, []);

  useEffect(() => {
    if (isNew || !articleId) return;
    setLoading(true);
    blogAdmin.one<BlogArticle>('articles', articleId)
      .then((res) => {
        const fetched = res.data;
        const trMap: Record<Lang, ArticleTranslation> = {
          pt: { ...EMPTY_TRANSLATION },
          es: { ...EMPTY_TRANSLATION },
          en: { ...EMPTY_TRANSLATION },
        };
        const trs = Array.isArray((fetched as unknown as { translations?: ArticleTranslation[] }).translations)
          ? ((fetched as unknown as { translations?: ArticleTranslation[] }).translations || [])
          : Object.values(fetched.translations || {});
        for (const tr of trs) {
          const lang = tr.lang as Lang;
          if (LANGS.includes(lang)) {
            trMap[lang] = {
              ...EMPTY_TRANSLATION,
              ...tr,
              // Auto-convert legacy block-array bodies into HTML.
              body: normalizeBody(tr.body),
            };
          }
        }
        setArticle({
          ...fetched,
          translations: trMap,
          authors: fetched.authors || [],
          tags: fetched.tags || [],
          keywords: fetched.keywords || [],
          sources: fetched.sources || [],
        });
        setKeywordsInput((fetched.keywords || []).map((k) => k.keyword).join(', '));
      })
      .finally(() => setLoading(false));
  }, [articleId, isNew]);

  const updateTranslation = (lang: Lang, field: keyof ArticleTranslation, value: unknown) => {
    setArticle((prev) => ({
      ...prev,
      translations: {
        ...(prev.translations || {}),
        [lang]: { ...(prev.translations?.[lang] || EMPTY_TRANSLATION), [field]: value },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        article: {
          id: article.id,
          category_id: article.category_id,
          read_time_minutes: article.read_time_minutes,
          image_url: article.image_url,
          image_width: article.image_width,
          image_height: article.image_height,
          status: article.status,
          is_featured: article.is_featured,
          trending_position: article.trending_position,
          published_at: article.published_at,
        },
        translations: article.translations,
        authors: (article.authors || []).map((a, i) => ({ author_id: a.author_id, position: a.position ?? i })),
        tags: (article.tags || []).map((tg) => tg.tag_id),
        keywords: keywordsInput.split(',').map((k) => k.trim()).filter(Boolean),
        sources: (article.sources || []).map((s) => ({ name: s.name, url: s.url })),
      };
      if (isNew) {
        await blogAdmin.create<BlogArticle>('articles', payload);
        navigate('/sa/blog/news');
      } else {
        await blogAdmin.update<BlogArticle>('articles', article.id, payload);
      }
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const addSource = () => {
    setArticle((prev) => ({
      ...prev,
      sources: [...(prev.sources || []), { name: '', url: '' }],
    }));
  };
  const updateSource = (idx: number, patch: Partial<{ name: string; url: string }>) => {
    setArticle((prev) => ({
      ...prev,
      sources: (prev.sources || []).map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };
  const removeSource = (idx: number) => {
    setArticle((prev) => ({
      ...prev,
      sources: (prev.sources || []).filter((_, i) => i !== idx),
    }));
  };

  const tr = article.translations?.[activeLang] || EMPTY_TRANSLATION;
  const tagIds = useMemo(() => new Set((article.tags || []).map((t) => t.tag_id)), [article.tags]);
  const authorIds = useMemo(() => new Set((article.authors || []).map((a) => a.author_id)), [article.authors]);

  const toggleTag = (tagId: string) => {
    setArticle((prev) => {
      const has = prev.tags?.some((t) => t.tag_id === tagId);
      return {
        ...prev,
        tags: has ? (prev.tags || []).filter((t) => t.tag_id !== tagId) : [...(prev.tags || []), { tag_id: tagId }],
      };
    });
  };

  const toggleAuthor = (authorId: string) => {
    setArticle((prev) => {
      const has = prev.authors?.some((a) => a.author_id === authorId);
      return {
        ...prev,
        authors: has
          ? (prev.authors || []).filter((a) => a.author_id !== authorId)
          : [...(prev.authors || []), { author_id: authorId, position: (prev.authors?.length || 0) }],
      };
    });
  };

  if (loading) {
    return <div className="p-10 text-center text-text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={isNew ? t('sa.blog.news.newArticle') : article.id}
        subtitle={isNew ? t('sa.blog.news.editorSubtitleNew') : t('sa.blog.news.editorSubtitleEdit')}
        icon={<Newspaper className="w-6 h-6 text-brand-primary" />}
      >
        <button onClick={() => navigate('/sa/blog/news')} className="btn btn-secondary btn-sm">
          <ChevronLeft className="w-4 h-4" />{t('sa.blog.back')}
        </button>
        <button onClick={handleSave} disabled={saving || !article.id} className="btn btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('sa.blog.save')}
        </button>
      </SAPageHeader>

      {/* Meta */}
      <div className="dashboard-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('sa.blog.news.metaSection')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.colId')}</label>
            <input value={article.id} onChange={(e) => setArticle({ ...article, id: e.target.value.replace(/[^a-z0-9-]/g, '-').toLowerCase() })} disabled={!isNew} placeholder="my-article-slug-2026" className="input-field !py-2 !text-sm w-full font-mono" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.colCategory')}</label>
            <select value={article.category_id} onChange={(e) => setArticle({ ...article, category_id: e.target.value })} className="input-field !py-2 !text-sm w-full">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.colStatus')}</label>
            <select value={article.status} onChange={(e) => setArticle({ ...article, status: e.target.value as ArticleStatus })} className="input-field !py-2 !text-sm w-full">
              <option value="draft">draft</option>
              <option value="scheduled">scheduled</option>
              <option value="published">published</option>
              <option value="retracted">retracted</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.colReadTime')}</label>
            <input type="number" value={article.read_time_minutes} onChange={(e) => setArticle({ ...article, read_time_minutes: Number(e.target.value) })} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.trendingPos')}</label>
            <input type="number" value={article.trending_position ?? ''} onChange={(e) => setArticle({ ...article, trending_position: e.target.value ? Number(e.target.value) : null })} placeholder="—" className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.imageUrl')}</label>
            <input value={article.image_url || ''} onChange={(e) => setArticle({ ...article, image_url: e.target.value || null })} placeholder="https://..." className="input-field !py-2 !text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.publishedAt')}</label>
            <input type="datetime-local" value={article.published_at?.slice(0, 16)} onChange={(e) => setArticle({ ...article, published_at: new Date(e.target.value).toISOString() })} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={article.is_featured} onChange={(e) => setArticle({ ...article, is_featured: e.target.checked })} className="accent-brand-primary" />
              {t('sa.blog.news.isFeatured')}
            </label>
          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.keywords')}</label>
          <input value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} placeholder="GEO, AI search, ChatGPT, Gemini..." className="input-field !py-2 !text-sm w-full" />
        </div>
      </div>

      {/* Authors */}
      <div className="dashboard-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('sa.blog.news.authorsSection')}</h3>
        <div className="flex flex-wrap gap-2">
          {authors.map((a) => (
            <button
              key={a.id}
              onClick={() => toggleAuthor(a.id)}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${authorIds.has(a.id)
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                : 'border-glass-border text-text-secondary hover:border-text-secondary'}`}
            >
              {a.id}{a.name ? ` · ${a.name}` : ''}
            </button>
          ))}
          {authors.length === 0 && <span className="text-xs text-text-muted">{t('sa.blog.news.noAuthorsYet')}</span>}
        </div>
      </div>

      {/* Tags */}
      <div className="dashboard-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('sa.blog.news.tagsSection')}</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tg) => (
            <button
              key={tg.id}
              onClick={() => toggleTag(tg.id)}
              className={`text-xs px-2.5 py-1.5 rounded-full border ${tagIds.has(tg.id)
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                : 'border-glass-border text-text-secondary hover:border-text-secondary'}`}
            >
              {tg.id}
            </button>
          ))}
        </div>
      </div>

      {/* Sources (external/academic citations — NewsArticle.citation[] in JSON-LD) */}
      <div className="dashboard-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('sa.blog.news.sourcesSection')}</h3>
          <button onClick={addSource} className="btn btn-secondary btn-sm">
            <Plus className="w-3.5 h-3.5" />{t('sa.blog.add')}
          </button>
        </div>
        <p className="text-xs text-text-muted">{t('sa.blog.news.sourcesHint')}</p>
        {(article.sources || []).length === 0 ? (
          <p className="text-xs text-text-muted italic">{t('sa.blog.news.noSources')}</p>
        ) : (
          <div className="space-y-2">
            {(article.sources || []).map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={s.name}
                  onChange={(e) => updateSource(idx, { name: e.target.value })}
                  placeholder={t('sa.blog.news.sourceName')}
                  className="input-field !py-1.5 !text-xs flex-1"
                />
                <input
                  value={s.url}
                  onChange={(e) => updateSource(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="input-field !py-1.5 !text-xs flex-1 font-mono"
                />
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="icon-btn text-brand-primary"><ExternalLink className="w-3.5 h-3.5" /></a>
                )}
                <button onClick={() => removeSource(idx)} className="icon-btn text-error/70 hover:text-error">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content per locale */}
      <div className="dashboard-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">{t('sa.blog.news.contentSection')}</h3>
          <div className="flex gap-1">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.slug')}</label>
            <input value={tr.slug} onChange={(e) => updateTranslation(activeLang, 'slug', e.target.value)} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.displayDate')}</label>
            <input value={tr.display_date} onChange={(e) => updateTranslation(activeLang, 'display_date', e.target.value)} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.title')}</label>
            <input value={tr.title} onChange={(e) => updateTranslation(activeLang, 'title', e.target.value)} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.dek')}</label>
            <textarea value={tr.dek} onChange={(e) => updateTranslation(activeLang, 'dek', e.target.value)} rows={2} className="input-field !py-2 !text-sm w-full resize-none" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.readTimeLabel')}</label>
            <input value={tr.read_time_label} onChange={(e) => updateTranslation(activeLang, 'read_time_label', e.target.value)} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.imageAlt')}</label>
            <input value={tr.image_alt || ''} onChange={(e) => updateTranslation(activeLang, 'image_alt', e.target.value)} className="input-field !py-2 !text-sm w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-secondary block mb-1">{t('sa.blog.news.toc')}</label>
            <textarea value={(tr.toc || []).join('\n')} onChange={(e) => updateTranslation(activeLang, 'toc', e.target.value.split('\n').filter(Boolean))} rows={3} className="input-field !py-2 !text-xs font-mono w-full resize-none" />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-secondary">{t('sa.blog.news.body')}</label>
            <button
              type="button"
              onClick={() => {
                const result = forceConvertJsonBody(tr.body || '');
                if (result.converted) {
                  updateTranslation(activeLang, 'body', result.html);
                  alert(t('sa.blog.news.convertJsonDone'));
                } else {
                  alert(t('sa.blog.news.convertJsonNoOp'));
                }
              }}
              className="text-xs px-2 py-1 rounded bg-glass-element text-text-secondary hover:bg-glass-hover flex items-center gap-1"
              title={t('sa.blog.news.convertJsonHint')}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {t('sa.blog.news.convertJson')}
            </button>
          </div>
          <RichTextEditor
            key={activeLang}
            value={tr.body || ''}
            onChange={(html) => updateTranslation(activeLang, 'body', html)}
          />
        </div>
      </div>
    </div>
  );
}
