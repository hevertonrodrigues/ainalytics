import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Newspaper, Trophy, Radio, Mail, Globe, RefreshCw } from 'lucide-react';
import { SAPageHeader } from '../SAPageHeader';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';

interface ModuleCard {
  path: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badge?: string;
}

// Two main hubs (News + Rankings) plus the cross-cutting tools that live
// outside either hub. Categories, tags, authors, brands, sectors, regions,
// engines, trending and ranking-FAQ are all reachable from inside the two
// hubs as inline filters / management modals — they no longer have their
// own dashboard cards.
const MODULES: ModuleCard[] = [
  {
    path: '/sa/blog/news',
    title: 'News',
    description: 'Articles, trending, categories, tags and authors — managed in one place.',
    icon: Newspaper, accent: 'text-brand-primary', badge: 'Hub',
  },
  {
    path: '/sa/blog/rankings',
    title: 'Rankings',
    description: 'AVI snapshots, brands, sectors, regions, engines and ranking FAQs.',
    icon: Trophy, accent: 'text-amber-500', badge: 'Hub',
  },
  {
    path: '/sa/blog/ticker',
    title: 'Ticker',
    description: 'Real-time engine signals shown at the top of every page.',
    icon: Radio, accent: 'text-pink-500',
  },
  {
    path: '/sa/blog/locale-meta',
    title: 'Locale meta',
    description: 'Per-language SEO config: site title, description, publisher, OG image.',
    icon: Globe, accent: 'text-indigo-500',
  },
  {
    path: '/sa/blog/newsletter',
    title: 'Newsletter',
    description: 'Subscriber list and status management.',
    icon: Mail, accent: 'text-rose-500',
  },
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

      {/* Two primary hubs first, then the standalone tools below. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULES.filter((m) => m.badge === 'Hub').map((m) => (
          <DashboardCard key={m.path} module={m} primary />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.filter((m) => !m.badge).map((m) => (
          <DashboardCard key={m.path} module={m} />
        ))}
      </div>
    </div>
  );
}

function DashboardCard({ module: m, primary }: { module: ModuleCard; primary?: boolean }) {
  const Icon = m.icon;
  return (
    <Link
      to={m.path}
      className={`dashboard-card hover:bg-glass-hover transition-colors group cursor-pointer ${
        primary ? 'p-6 border border-brand-primary/20' : 'p-5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg bg-glass-element ${m.accent}`}>
          <Icon className={primary ? 'w-6 h-6' : 'w-5 h-5'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-text-primary truncate ${primary ? 'text-base' : 'text-sm'}`}>
              {m.title}
            </h3>
            {m.badge && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-primary/15 text-brand-primary">
                {m.badge}
              </span>
            )}
          </div>
          <p className={`text-text-secondary mt-1 line-clamp-2 ${primary ? 'text-sm' : 'text-xs'}`}>
            {m.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
