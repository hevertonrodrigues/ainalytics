import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowUp, ArrowDown, Loader2, X, Plus, Save } from 'lucide-react';
import { blogAdmin } from './useBlogAdmin';
import { SAPageHeader } from '../SAPageHeader';
import { TemplateDownloadButton } from './JsonToolbar';
import { TRENDING_TEMPLATE } from './templates';
import type { BlogArticle } from './types';

export function BlogTrendingPage() {
  const { t } = useTranslation();
  const [trending, setTrending] = useState<BlogArticle[]>([]);
  const [available, setAvailable] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([
      blogAdmin.list<BlogArticle>('articles', { trending: 'true', limit: 100 }),
      blogAdmin.list<BlogArticle>('articles', { status: 'published', limit: 200 }),
    ]).then(([trend, all]) => {
      const trendList = trend.data.slice().sort((a, b) => (a.trending_position || 0) - (b.trending_position || 0));
      const trendIds = new Set(trendList.map((a) => a.id));
      setTrending(trendList);
      setAvailable(all.data.filter((a) => !trendIds.has(a.id)));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const setPosition = async (id: string, position: number | null) => {
    await blogAdmin.call('POST', `/blog-admin/articles/${id}/trending`, { trending_position: position });
  };

  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    const a = trending[idx];
    const b = trending[idx - 1];
    if (!a || !b) return;
    setSaving(true);
    await Promise.all([
      setPosition(a.id, b.trending_position || idx),
      setPosition(b.id, a.trending_position || idx + 1),
    ]);
    reload();
    setSaving(false);
  };

  const moveDown = async (idx: number) => {
    if (idx >= trending.length - 1) return;
    const a = trending[idx];
    const b = trending[idx + 1];
    if (!a || !b) return;
    setSaving(true);
    await Promise.all([
      setPosition(a.id, b.trending_position || idx + 2),
      setPosition(b.id, a.trending_position || idx + 1),
    ]);
    reload();
    setSaving(false);
  };

  const addToTrending = async (id: string) => {
    setSaving(true);
    const next = (trending[trending.length - 1]?.trending_position || trending.length) + 1;
    await setPosition(id, next);
    reload();
    setSaving(false);
  };

  const removeFromTrending = async (id: string) => {
    setSaving(true);
    await setPosition(id, null);
    reload();
    setSaving(false);
  };

  const renormalize = async () => {
    setSaving(true);
    await Promise.all(trending.map((a, idx) => setPosition(a.id, idx + 1)));
    reload();
    setSaving(false);
  };

  if (loading) return <div className="dashboard-card p-6 h-32 animate-pulse bg-glass-element" />;

  const titleOf = (a: BlogArticle) => {
    const tt = a.translations || {};
    return tt.en?.title || tt.pt?.title || tt.es?.title || a.id;
  };

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.modules.trending.title')}
        subtitle={t('sa.blog.modules.trending.description')}
        icon={<Sparkles className="w-6 h-6 text-brand-primary" />}
      >
        <TemplateDownloadButton template={TRENDING_TEMPLATE} filename="trending-template.json" />
        <button onClick={renormalize} disabled={saving || trending.length === 0} className="btn btn-secondary btn-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('sa.blog.trending.renormalize')}
        </button>
      </SAPageHeader>

      <div className="dashboard-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">{t('sa.blog.trending.activeFeed')}</h3>
        {trending.length === 0 ? (
          <p className="text-xs text-text-muted italic">{t('sa.blog.trending.empty')}</p>
        ) : (
          <div className="space-y-2">
            {trending.map((a, idx) => (
              <div key={a.id} className="flex items-center gap-2 p-3 bg-glass-element rounded-md">
                <span className="text-lg font-bold text-brand-primary w-8 text-center">#{a.trending_position || idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <Link to={`/sa/blog/news/${a.id}`} className="text-sm font-semibold text-text-primary hover:text-brand-primary truncate block">
                    {titleOf(a)}
                  </Link>
                  <span className="text-xs text-text-muted font-mono">{a.id}</span>
                </div>
                <button onClick={() => moveUp(idx)} disabled={idx === 0 || saving} className="icon-btn"><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => moveDown(idx)} disabled={idx === trending.length - 1 || saving} className="icon-btn"><ArrowDown className="w-4 h-4" /></button>
                <button onClick={() => removeFromTrending(a.id)} disabled={saving} className="icon-btn text-error/70 hover:text-error"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">{t('sa.blog.trending.availablePool')}</h3>
        {available.length === 0 ? (
          <p className="text-xs text-text-muted italic">{t('sa.blog.trending.noAvailable')}</p>
        ) : (
          <div className="space-y-2">
            {available.map((a) => (
              <div key={a.id} className="flex items-center gap-2 p-3 bg-glass-element rounded-md">
                <div className="flex-1 min-w-0">
                  <Link to={`/sa/blog/news/${a.id}`} className="text-sm font-semibold text-text-primary hover:text-brand-primary truncate block">
                    {titleOf(a)}
                  </Link>
                  <span className="text-xs text-text-muted font-mono">{a.id}</span>
                </div>
                <button onClick={() => addToTrending(a.id)} disabled={saving} className="btn btn-secondary btn-sm">
                  <Plus className="w-3.5 h-3.5" />{t('sa.blog.trending.promote')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
