import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Newspaper, FolderTree, Tags, Users, Building2, Trophy, Radio, Mail, Sparkles, Globe, HelpCircle, RefreshCw,
} from 'lucide-react';
import { SAPageHeader } from '../SAPageHeader';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';

interface ModuleCard {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const MODULES: ModuleCard[] = [
  { key: 'sa.blog.modules.news',       path: '/sa/blog/news',       icon: Newspaper,  accent: 'text-brand-primary' },
  { key: 'sa.blog.modules.trending',   path: '/sa/blog/trending',   icon: Sparkles,   accent: 'text-yellow-500' },
  { key: 'sa.blog.modules.categories', path: '/sa/blog/categories', icon: FolderTree, accent: 'text-blue-500' },
  { key: 'sa.blog.modules.tags',       path: '/sa/blog/tags',       icon: Tags,       accent: 'text-purple-500' },
  { key: 'sa.blog.modules.authors',    path: '/sa/blog/authors',    icon: Users,      accent: 'text-emerald-500' },
  { key: 'sa.blog.modules.brands',     path: '/sa/blog/brands',     icon: Building2,  accent: 'text-cyan-500' },
  { key: 'sa.blog.modules.rankings',   path: '/sa/blog/rankings',   icon: Trophy,     accent: 'text-amber-500' },
  { key: 'sa.blog.modules.rankingFaq', path: '/sa/blog/ranking-faq',icon: HelpCircle, accent: 'text-violet-500' },
  { key: 'sa.blog.modules.ticker',     path: '/sa/blog/ticker',     icon: Radio,      accent: 'text-pink-500' },
  { key: 'sa.blog.modules.localeMeta', path: '/sa/blog/locale-meta', icon: Globe,      accent: 'text-indigo-500' },
  { key: 'sa.blog.modules.newsletter', path: '/sa/blog/newsletter', icon: Mail,       accent: 'text-rose-500' },
];

export function BlogDashboardPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { confirm } = useDialog();
  const [isRevalidating, setIsRevalidating] = useState(false);

  async function handleRevalidateAll() {
    if (isRevalidating) return;
    const ok = await confirm({
      message: t('sa.blog.dashboard.revalidate.confirm'),
      confirmLabel: t('sa.blog.dashboard.revalidate.label'),
      variant: 'primary',
    });
    if (!ok) return;
    setIsRevalidating(true);
    try {
      await apiClient.post('/blog-revalidate', { event: 'purge' });
      showToast(t('sa.blog.dashboard.revalidate.success'), 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t('sa.blog.dashboard.revalidate.error'),
        'error',
      );
    } finally {
      setIsRevalidating(false);
    }
  }

  return (
    <div className="stagger-enter space-y-6">
      <SAPageHeader
        title={t('sa.blog.dashboard.title')}
        subtitle={t('sa.blog.dashboard.subtitle')}
        icon={<Newspaper className="w-6 h-6 text-brand-primary" />}
      >
        <button
          type="button"
          onClick={handleRevalidateAll}
          disabled={isRevalidating}
          className="btn btn-primary btn-sm gap-1.5 disabled:opacity-60"
          title={t('sa.blog.dashboard.revalidate.title')}
        >
          <RefreshCw className={`w-4 h-4 ${isRevalidating ? 'animate-spin' : ''}`} />
          <span>{isRevalidating ? t('sa.blog.dashboard.revalidate.loading') : t('sa.blog.dashboard.revalidate.label')}</span>
        </button>
      </SAPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map(({ key, path, icon: Icon, accent }) => (
          <Link
            key={path}
            to={path}
            className="dashboard-card p-5 hover:bg-glass-hover transition-colors group cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg bg-glass-element ${accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary truncate">
                  {t(`${key}.title`)}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                  {t(`${key}.description`)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
