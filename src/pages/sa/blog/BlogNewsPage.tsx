import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Newspaper, Plus, Pencil, Trash2, Search, ExternalLink, Loader2, Sparkles,
  Wand2, AlertTriangle, FolderTree, Tags as TagsIcon, Users,
} from 'lucide-react';
import { useBlogAdmin, blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { formatDate } from '@/lib/dateFormat';
import { NewsImportButton, TemplateDownloadButton } from './JsonToolbar';
import { NEWS_TEMPLATE } from './templates';
import { SearchSelectMulti } from '@/components/ui/SearchSelectMulti';
import { LANGS, type Lang, type BlogArticle, type ArticleStatus, type BlogCategory } from './types';
import { useDialog } from '@/contexts/DialogContext';
import { EmbedPageModal } from './modals/EmbedPageModal';

const CategoriesEditor = lazy(() => import('./BlogCategoriesPage').then((m) => ({ default: m.BlogCategoriesPage })));
const TagsEditor       = lazy(() => import('./BlogTagsPage').then((m) => ({ default: m.BlogTagsPage })));
const AuthorsEditor    = lazy(() => import('./BlogAuthorsPage').then((m) => ({ default: m.BlogAuthorsPage })));

type ManagePane = 'categories' | 'tags' | 'authors' | null;

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft:     'bg-text-muted/20 text-text-secondary',
  scheduled: 'bg-blue-500/15 text-blue-500',
  published: 'bg-success/15 text-success',
  retracted: 'bg-error/15 text-error',
};

const STATUS_OPTIONS: ArticleStatus[] = ['draft', 'scheduled', 'published', 'retracted'];

function getTitleForLang(
  translations: Record<string, { slug: string; title: string }> | undefined,
  active: Lang,
): { title: string; lang: Lang | null; missing: boolean } {
  const trs = translations || {};
  const direct = trs[active];
  if (direct?.title) return { title: direct.title, lang: active, missing: false };
  // Fallback to any locale that has a title
  for (const l of LANGS) {
    const tr = trs[l];
    if (tr?.title) return { title: tr.title, lang: l, missing: true };
  }
  return { title: '', lang: null, missing: true };
}

export function BlogNewsPage() {
  const { t, i18n } = useTranslation();
  const { alert, confirm } = useDialog();

  // ─── filters ──────────────────────────────────────────────────────────────

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [managePane, setManagePane] = useState<ManagePane>(null);
  const [activeLang, setActiveLang] = useState<Lang>(() => {
    const sys = i18n.language?.toLowerCase();
    if (sys === 'es') return 'es';
    if (sys === 'pt-br' || sys === 'pt') return 'pt';
    return 'en';
  });

  const { data: articles, isLoading, refetch, remove } = useBlogAdmin<BlogArticle>('articles', {
    query: {
      status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
      category: categoryFilter.length > 0 ? categoryFilter.join(',') : undefined,
      q: search || undefined,
    },
  });

  // Trending is just a flag on each article (trending_position != null), so
  // we filter client-side rather than threading a server-side query param.
  const visibleArticles = useMemo(
    () => trendingOnly ? articles.filter((a) => a.trending_position != null) : articles,
    [articles, trendingOnly],
  );

  // ─── categories — for the multi-select options ───────────────────────────

  const [categories, setCategories] = useState<BlogCategory[]>([]);
  useEffect(() => {
    blogAdmin.list<BlogCategory>('categories').then((r) => setCategories(r.data)).catch(() => undefined);
  }, []);

  // Pick a label that follows the SA admin UI language.
  const adminLang: Lang = useMemo(() => {
    const sys = i18n.language?.toLowerCase();
    if (sys === 'es') return 'es';
    if (sys === 'pt-br' || sys === 'pt') return 'pt';
    return 'en';
  }, [i18n.language]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({
      value: c.id,
      label: c.labels?.[adminLang]?.label || c.labels?.en?.label || c.id,
    })),
    [categories, adminLang],
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
    [],
  );

  // ─── action handlers ─────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: t('sa.blog.confirmDelete'), variant: 'danger' }))) return;
    await remove(id);
  };
  const handlePublish = async (id: string) => {
    await blogAdmin.call('POST', `/blog-admin/articles/${id}/publish`);
    refetch();
  };
  const handleRetract = async (id: string) => {
    if (!(await confirm({ message: t('sa.blog.news.confirmRetract'), variant: 'warning' }))) return;
    await blogAdmin.call('POST', `/blog-admin/articles/${id}/retract`);
    refetch();
  };
  const handleTrendingToggle = async (a: BlogArticle) => {
    const next = a.trending_position == null ? (articles.length + 1) : null;
    await blogAdmin.call('POST', `/blog-admin/articles/${a.id}/trending`, { trending_position: next });
    refetch();
  };

  const [converting, setConverting] = useState(false);
  const handleConvertAll = async () => {
    if (!(await confirm({ message: t('sa.blog.news.convertAllConfirm'), variant: 'primary' }))) return;
    setConverting(true);
    try {
      const res = await blogAdmin.call<{ scanned: number; converted: number }>('POST', '/blog-admin/articles/convert-bodies');
      const { scanned, converted } = res.data;
      void alert({ message: t('sa.blog.news.convertAllDone', { scanned, converted }), variant: 'success' });
      if (converted > 0) refetch();
    } catch (err) {
      void alert({ message: `${t('sa.blog.news.convertAllFailed')}: ${(err as Error).message}`, variant: 'error' });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.news.title')}
        subtitle={t('sa.blog.news.subtitle')}
        icon={<Newspaper className="w-6 h-6 text-brand-primary" />}
      >
        {/* Manage modal triggers — open the existing CRUD pages inline so we
            keep one News hub instead of five separate dashboard cards. */}
        <button onClick={() => setManagePane('categories')} className="btn btn-ghost btn-sm gap-1.5" title="Manage categories">
          <FolderTree className="w-4 h-4" />
          <span className="hidden sm:inline">Categories</span>
        </button>
        <button onClick={() => setManagePane('tags')} className="btn btn-ghost btn-sm gap-1.5" title="Manage tags">
          <TagsIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Tags</span>
        </button>
        <button onClick={() => setManagePane('authors')} className="btn btn-ghost btn-sm gap-1.5" title="Manage authors">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Authors</span>
        </button>
        <span className="hidden sm:inline-block w-px h-5 bg-glass-border" />
        <button
          type="button"
          onClick={handleConvertAll}
          disabled={converting}
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
          title={t('sa.blog.news.convertAllHint')}
        >
          {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{t('sa.blog.news.convertAll')}</span>
        </button>
        <TemplateDownloadButton template={NEWS_TEMPLATE} filename="news-template.json" />
        <NewsImportButton
          onImported={({ ok, failed, total }) => {
            const failedMsg = failed.length
              ? `\n\n${t('sa.blog.io.failedRows')}:\n${failed.map((f) => `[${f.index}] ${f.error}`).join('\n')}`
              : '';
            void alert({ message: t('sa.blog.io.importDone', { ok, total }) + failedMsg, variant: failed.length ? 'warning' : 'success' });
            refetch();
          }}
        />
        <Link to="/sa/blog/news/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('sa.blog.news.newArticle')}
        </Link>
      </SAPageHeader>

      {/* Filter row */}
      <div className="dashboard-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refetch()}
            placeholder={t('sa.blog.news.searchPlaceholder')}
            className="input-field !pl-8 !py-2 !text-sm w-full"
          />
        </div>
        <div className="min-w-[180px]">
          <SearchSelectMulti
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder={t('sa.blog.news.allStatuses')}
            searchPlaceholder={t('sa.blog.news.searchStatuses')}
            formatCount={(n) => t('sa.blog.news.nSelected', { n })}
          />
        </div>
        <div className="min-w-[200px]">
          <SearchSelectMulti
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder={t('sa.blog.news.allCategories')}
            searchPlaceholder={t('sa.blog.news.searchCategories')}
            formatCount={(n) => t('sa.blog.news.nSelected', { n })}
          />
        </div>
        <button
          type="button"
          onClick={() => setTrendingOnly(v => !v)}
          className={`btn btn-sm gap-1.5 ${
            trendingOnly ? 'btn-primary' : 'btn-ghost'
          }`}
          title="Show only trending articles"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trending</span>
          {trendingOnly && (
            <span className="text-[10px] font-mono">
              {visibleArticles.length}
            </span>
          )}
        </button>
        <button onClick={() => refetch()} className="btn btn-secondary btn-sm">
          {t('sa.blog.refresh')}
        </button>
      </div>

      {/* Language tabs — controls which translation's title each row shows */}
      <div className="dashboard-card p-3 flex items-center gap-2">
        <span className="text-xs text-text-muted">{t('sa.blog.news.viewIn')}:</span>
        <div className="flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setActiveLang(l)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${
                activeLang === l
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:bg-glass-hover'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="dashboard-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : articles.length === 0 ? (
          <div className="p-10 text-center text-text-muted">{t('sa.blog.noResults')}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-left">{t('sa.blog.news.colTitle')}</th>
                <th className="text-left hidden md:table-cell">{t('sa.blog.news.colCategory')}</th>
                <th className="text-center">{t('sa.blog.news.colStatus')}</th>
                <th className="text-center hidden lg:table-cell">{t('sa.blog.news.colTrending')}</th>
                <th className="text-center hidden lg:table-cell">{t('sa.blog.news.colPublished')}</th>
                <th className="text-right">{t('sa.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleArticles.map((a) => {
                const trs = a.translations || {};
                const { title, lang: shownLang, missing } = getTitleForLang(trs, activeLang);
                const slug = trs[activeLang]?.slug || trs.pt?.slug || trs.en?.slug || trs.es?.slug || '';
                const previewLang = shownLang || 'pt';
                return (
                  <tr key={a.id}>
                    <td className="!font-body">
                      <div className="flex flex-col">
                        <span className="font-semibold text-text-primary flex items-center gap-2">
                          <span>{title || a.id}</span>
                          {missing && shownLang && (
                            <span
                              title={t('sa.blog.news.missingTranslation', {
                                lang: activeLang.toUpperCase(),
                                fallback: shownLang.toUpperCase(),
                              })}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500 uppercase font-semibold"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {shownLang}
                            </span>
                          )}
                          {missing && !shownLang && (
                            <span
                              title={t('sa.blog.news.noTranslations')}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-error/15 text-error uppercase font-semibold"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {t('sa.blog.news.untranslated')}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-text-muted font-mono">{a.id}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-xs">{a.category_id}</td>
                    <td className="text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="text-center hidden lg:table-cell">
                      <button
                        onClick={() => handleTrendingToggle(a)}
                        className={`p-1 rounded ${a.trending_position != null ? 'bg-yellow-500/15 text-yellow-500' : 'text-text-muted hover:text-yellow-500'}`}
                        title={t('sa.blog.news.toggleTrending')}
                      >
                        <Sparkles className="w-4 h-4" />
                        {a.trending_position != null && <span className="ml-1 text-xs">#{a.trending_position}</span>}
                      </button>
                    </td>
                    <td className="text-center hidden lg:table-cell text-xs">{formatDate(a.published_at)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.status !== 'published' && (
                          <button onClick={() => handlePublish(a.id)} className="text-xs px-2 py-1 rounded-md bg-success/15 text-success hover:bg-success/25">
                            {t('sa.blog.news.publish')}
                          </button>
                        )}
                        {a.status === 'published' && (
                          <button onClick={() => handleRetract(a.id)} className="text-xs px-2 py-1 rounded-md bg-error/15 text-error hover:bg-error/25">
                            {t('sa.blog.news.retract')}
                          </button>
                        )}
                        <Link to={`/sa/blog/news/${a.id}`} className="icon-btn">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        {slug && (
                          <a href={`https://indexai.news/${previewLang}/${slug}`} target="_blank" rel="noreferrer" className="icon-btn">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => handleDelete(a.id)} className="icon-btn text-error/70 hover:text-error">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {managePane && (
        <EmbedPageModal
          title={managePane === 'categories' ? 'Manage categories'
               : managePane === 'tags'       ? 'Manage tags'
               : 'Manage authors'}
          onClose={() => { setManagePane(null); refetch(); }}
        >
          <Suspense fallback={<div className="py-12 text-center text-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}>
            {managePane === 'categories' && <CategoriesEditor />}
            {managePane === 'tags'       && <TagsEditor />}
            {managePane === 'authors'    && <AuthorsEditor />}
          </Suspense>
        </EmbedPageModal>
      )}
    </div>
  );
}
