import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/dateFormat';
import {
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  BarChart3,
  Repeat,
  User,
  Mail,
  Shield,
  CalendarClock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { CRMPipelineUser, KanbanStage } from './types';
import { KANBAN_STAGES } from './types';
import { SAPageHeader } from './SAPageHeader';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-glass-element rounded-md ${className}`} />;
}

export function SADashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [users, setUsers] = useState<CRMPipelineUser[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const res = await apiClient.get<CRMPipelineUser[]>('/admin-crm-pipeline');
        if (mounted) { setUsers(res.data); setError(null); }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Computed Metrics ──
  const metrics = useMemo(() => {
    if (!users) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    let activeSubs = 0;
    let totalMrr = 0;
    let cancelled = 0;
    let trialing = 0;
    let mau = 0;

    const stageCounts: Record<KanbanStage, number> = {} as Record<KanbanStage, number>;
    KANBAN_STAGES.forEach(s => { stageCounts[s] = 0; });

    const recentUsers: CRMPipelineUser[] = [];
    const expiringUsers: CRMPipelineUser[] = [];

    users.forEach(u => {
      // Stage counts
      if (u.stage) stageCounts[u.stage] = (stageCounts[u.stage] || 0) + 1;

      // Active subs + MRR
      if (u.subscription_status === 'active' || u.subscription_status === 'trialing') {
        activeSubs++;
        if (u.subscription_status === 'trialing') trialing++;
        if (u.billing_interval === 'monthly') totalMrr += Number(u.paid_amount);
        if (u.billing_interval === 'yearly') totalMrr += Number(u.paid_amount) / 12;
      }

      // Cancelled (churned)
      if (u.stage === 'churned_from_trial' || u.stage === 'churned_from_paid') cancelled++;

      // MAU (signed in within 30 days)
      if (u.last_sign_in_at) {
        const signIn = new Date(u.last_sign_in_at);
        if (signIn >= thirtyDaysAgo) mau++;
      }

      // Recent users (registered within 30 days)
      if (u.created_at) {
        const created = new Date(u.created_at);
        if (created >= thirtyDaysAgo) recentUsers.push(u);
      }

      // Expiring soon
      if (u.current_period_end) {
        const endDate = new Date(u.current_period_end);
        if (endDate <= oneMonthFromNow && endDate > now &&
          (u.subscription_status === 'active' || u.subscription_status === 'trialing')) {
          expiringUsers.push(u);
        }
      }
    });

    // Sort recent by date desc, take 10
    recentUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recent = recentUsers.slice(0, 10);

    // Sort expiring by end date asc
    expiringUsers.sort((a, b) => new Date(a.current_period_end!).getTime() - new Date(b.current_period_end!).getTime());

    // Conversion rate: (active_stripe + active_activation) / (trial_stripe + trial_activation + active_stripe + active_activation)
    const trialCount = (stageCounts.trial_stripe || 0) + (stageCounts.trial_activation || 0);
    const activeCount = (stageCounts.active_stripe || 0) + (stageCounts.active_activation || 0);
    const conversionBase = trialCount + activeCount;
    const conversionRate = conversionBase > 0 ? (activeCount / conversionBase) * 100 : 0;

    // Churn rate
    const churnBase = activeSubs + cancelled;
    const churnRate = churnBase > 0 ? (cancelled / churnBase) * 100 : 0;

    return {
      totalUsers: users.length,
      activeSubs,
      mrr: totalMrr,
      mau,
      cancelled,
      trialing,
      conversionRate,
      churnRate,
      stageCounts,
      recentUsers: recent,
      expiringUsers,
    };
  }, [users]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="dashboard-card p-6 h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="dashboard-card p-6 h-[350px]" />
          <div className="dashboard-card p-6 h-[350px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card p-6 border-error border bg-error/5">
        <h3 className="text-error font-medium">{t('sa.failedLoad')}</h3>
        <p className="text-sm text-error/80 mt-1">{error.message}</p>
      </div>
    );
  }

  if (!metrics) return null;

  const stageColorMap: Record<KanbanStage, string> = {
    registered: 'bg-text-muted/20 text-text-muted',
    email_confirmed: 'bg-chart-cyan/15 text-chart-cyan',
    proposal_accepted: 'bg-brand-accent/15 text-brand-accent',
    trial_activation: 'bg-warning/15 text-warning',
    trial_stripe: 'bg-warning/15 text-warning',
    trial_other: 'bg-chart-orange/15 text-chart-orange',
    free_user: 'bg-text-muted/15 text-text-muted',
    active_activation: 'bg-success/15 text-success',
    active_stripe: 'bg-success/15 text-success',
    active_other: 'bg-success/15 text-success',
    churned_from_trial: 'bg-warning/15 text-warning',
    churned_from_paid: 'bg-error/15 text-error',
  };

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <SAPageHeader title={t('sa.dashboard')} subtitle={t('sa.dashboardSubtitle')} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          icon={<Users className="w-4 h-4" />}
          label={t('sa.totalUsers')}
          value={metrics.totalUsers.toString()}
        />
        <KPICard
          icon={<CreditCard className="w-4 h-4" />}
          label={t('sa.activeSubs')}
          value={metrics.activeSubs.toString()}
          subValue={metrics.trialing > 0 ? `${metrics.trialing} ${t('sa.trialing')}` : undefined}
          valueColor="text-brand-primary"
        />
        <KPICard
          icon={<TrendingUp className="w-4 h-4" />}
          label={t('sa.estMRR')}
          value={`$${metrics.mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          valueColor="text-success"
        />
        <KPICard
          icon={<Activity className="w-4 h-4" />}
          label={t('sa.mau')}
          value={metrics.mau.toString()}
          subValue={t('sa.mauTooltip')}
          valueColor="text-chart-cyan"
        />
        <KPICard
          icon={<Repeat className="w-4 h-4" />}
          label={t('sa.conversionRate')}
          value={`${metrics.conversionRate.toFixed(1)}%`}
          subValue={t('sa.trialToPaid')}
          trend={metrics.conversionRate >= 50 ? 'up' : 'down'}
          valueColor={metrics.conversionRate >= 50 ? 'text-success' : 'text-warning'}
        />
        <KPICard
          icon={<BarChart3 className="w-4 h-4" />}
          label={t('sa.churnRate')}
          value={`${metrics.churnRate.toFixed(1)}%`}
          trend={metrics.churnRate <= 5 ? 'up' : 'down'}
          valueColor={metrics.churnRate <= 5 ? 'text-success' : 'text-error'}
        />
      </div>

      {/* Users by Status + Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Status */}
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">{t('sa.usersByStatus')}</h2>
            <span className="text-xs text-text-muted">{metrics.totalUsers} {t('sa.totalUsers').toLowerCase()}</span>
          </div>
          <div className="space-y-2.5">
            {KANBAN_STAGES.map(stage => {
              const count = metrics.stageCounts[stage] || 0;
              const pct = metrics.totalUsers > 0 ? (count / metrics.totalUsers) * 100 : 0;
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider min-w-[110px] justify-center ${stageColorMap[stage]}`}>
                    {t(`sa.stage_${stage}`)}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        stage.includes('active') ? 'bg-success' :
                        stage.includes('trial') ? 'bg-warning' :
                        stage === 'churned_from_paid' ? 'bg-error' :
                        stage === 'churned_from_trial' ? 'bg-warning' :
                        stage === 'free_user' ? 'bg-text-muted/60' :
                        stage === 'proposal_accepted' ? 'bg-brand-accent' :
                        'bg-text-muted/40'
                      }`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-[60px] justify-end">
                    <span className="text-sm font-semibold text-text-primary">{count}</span>
                    <span className="text-[10px] text-text-muted">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-semibold text-text-primary">{t('sa.expiringSoon')}</h2>
            </div>
            {metrics.expiringUsers.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-warning/15 text-warning">
                {metrics.expiringUsers.length}
              </span>
            )}
          </div>
          {metrics.expiringUsers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-text-muted text-sm">
              {t('sa.noExpiring')}
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {metrics.expiringUsers.map(u => {
                const daysLeft = Math.ceil((new Date(u.current_period_end!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div
                    key={u.user_id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-secondary/40 hover:bg-glass-hover transition-colors cursor-pointer"
                    onClick={() => navigate(`/sa/users/${u.user_id}`)}
                  >
                    <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center shrink-0 border border-warning/20">
                      <Timer className="w-3.5 h-3.5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{u.full_name || t('sa.unnamed')}</div>
                      <div className="text-xs text-text-muted truncate">{u.plan_name}</div>
                    </div>
                    <span className={`text-xs font-semibold whitespace-nowrap ${
                      daysLeft <= 7 ? 'text-error' : daysLeft <= 14 ? 'text-warning' : 'text-text-secondary'
                    }`}>
                      {t('sa.daysLeft', { count: daysLeft })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Users */}
      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-primary" />
            <h2 className="text-sm font-semibold text-text-primary">{t('sa.recentUsers')}</h2>
          </div>
          <button
            onClick={() => navigate('/sa/crm')}
            className="text-xs text-brand-primary hover:text-brand-secondary transition-colors font-medium"
          >
            {t('sa.viewAllCRM')} →
          </button>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {metrics.recentUsers.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-6">{t('sa.noUsersFound')}</div>
          ) : metrics.recentUsers.map(user => (
            <div
              key={user.user_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary/40 hover:bg-glass-hover transition-colors cursor-pointer"
              onClick={() => navigate(`/sa/users/${user.user_id}`)}
            >
              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20">
                <User className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate text-sm flex items-center gap-1.5">
                  {user.full_name || t('sa.unnamed')}
                  {user.is_sa && <Shield className="w-3 h-3 text-brand-accent" />}
                </div>
                <div className="text-xs text-text-muted truncate">{user.email}</div>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${stageColorMap[user.stage]}`}>
                  {t(`sa.stage_${user.stage}`)}
                </span>
                <div className="text-[10px] text-text-muted mt-0.5">{formatDate(user.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-muted bg-bg-secondary/50 border-b border-glass-border">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('sa.colUser')}</th>
                <th className="px-4 py-2.5 font-medium">{t('sa.colCompany')}</th>
                <th className="px-4 py-2.5 font-medium">{t('sa.stage')}</th>
                <th className="px-4 py-2.5 font-medium text-right">{t('sa.colDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {metrics.recentUsers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-text-muted">{t('sa.noUsersFound')}</td></tr>
              ) : metrics.recentUsers.map(user => (
                <tr
                  key={user.user_id}
                  className="hover:bg-glass-hover transition-colors cursor-pointer"
                  onClick={() => navigate(`/sa/users/${user.user_id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0 border border-brand-primary/20">
                        <User className="w-3.5 h-3.5 text-brand-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate flex items-center gap-1">
                          {user.full_name || t('sa.unnamed')}
                          {user.is_sa && <Shield className="w-3 h-3 text-brand-accent" />}
                        </div>
                        <div className="text-xs text-text-muted flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />{user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {user.company_name || user.company_domain ? (
                      <span className="text-text-secondary text-sm">{user.company_name || user.company_domain}</span>
                    ) : <span className="text-xs text-text-muted italic">{t('sa.noCompany')}</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${stageColorMap[user.stage]}`}>
                      {t(`sa.stage_${user.stage}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-text-secondary text-sm whitespace-nowrap">{formatDate(user.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──

function KPICard({
  icon,
  label,
  value,
  subValue,
  valueColor = 'text-text-primary',
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  valueColor?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="dashboard-card p-4 relative overflow-hidden group">
      <div className="flex items-center gap-2 text-text-muted mb-2">
        {icon}
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
        {trend && (
          trend === 'up'
            ? <ArrowUpRight className="w-3.5 h-3.5 text-success mb-0.5" />
            : <ArrowDownRight className="w-3.5 h-3.5 text-error mb-0.5" />
        )}
      </div>
      {subValue && (
        <p className="text-[10px] text-text-muted mt-1 truncate">{subValue}</p>
      )}
    </div>
  );
}
