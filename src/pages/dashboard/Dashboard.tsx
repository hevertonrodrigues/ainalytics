import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, User, Settings, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);

  // Simulate data loading — in the future replace with real data fetching
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="skeleton h-8 w-72 rounded" />
          <div className="skeleton h-4 w-40 rounded mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 space-y-3">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-8 w-28 rounded" />
              <div className="skeleton h-2 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="glass-card p-6">
          <div className="skeleton h-5 w-32 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t('dashboard.welcomeUser', { name: profile?.full_name || '' })}
        </h1>
        {currentTenant && (
          <p className="text-text-secondary mt-1">{currentTenant.name}</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('nav.profile')}
          value={profile?.full_name || '—'}
          detail={profile?.email || ''}
        />
        <StatCard
          label={t('tenant.current')}
          value={currentTenant?.name || '—'}
          detail={currentTenant?.slug || ''}
        />
        <StatCard
          label={t('profile.locale')}
          value={(profile?.locale || 'en').toUpperCase()}
          detail={t('dashboard.title')}
        />
        <StatCard
          label={t('settings.title')}
          value="0"
          detail={t('settings.noSettings')}
        />
      </div>

      {/* Getting Started */}
      <div className="glass-card p-8">
        <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-brand-secondary" />
          {t('dashboard.title')}
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          {t('dashboard.welcomeUser', { name: profile?.full_name || '' })}
          {' — '}
          {t('dashboard.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            icon={<User className="w-6 h-6 text-brand-secondary" />}
            title={t('nav.profile')}
            description={t('profile.title')}
            href="/profile"
          />
          <QuickAction
            icon={<Settings className="w-6 h-6 text-brand-secondary" />}
            title={t('nav.settings')}
            description={t('settings.title')}
            href="/settings"
          />
          <QuickAction
            icon={<Globe className="w-6 h-6 text-brand-secondary" />}
            title={t('profile.locale')}
            description="EN · ES · PT-BR"
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="glass-card p-6 space-y-2">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-text-primary truncate">{value}</p>
      <p className="text-xs text-text-secondary truncate">{detail}</p>
    </div>
  );
}

function QuickAction({ icon, title, description, href }: { icon: ReactNode; title: string; description: string; href?: string }) {
  const content = (
    <div className="glass-card p-5 hover:bg-glass-hover transition-all duration-200 cursor-pointer group">
      <div className="mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-text-primary group-hover:text-brand-secondary transition-colors">{title}</h3>
      <p className="text-xs text-text-muted mt-1">{description}</p>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  return content;
}
