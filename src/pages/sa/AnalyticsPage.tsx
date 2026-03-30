import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime, formatDate } from '@/lib/dateFormat';
import { apiClient } from '@/lib/api';
import { SAPageHeader } from './SAPageHeader';
import {
  Activity,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Globe,
  Smartphone,
  Timer,
  Layers,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

/* ─── Types ─── */

interface FunnelUser {
  user_id: string;
  email: string;
  full_name: string | null;
  signup_at: string;
  tenant_name: string | null;
  has_plan: boolean;
  has_seen_onboarding: boolean;
  reached_welcome: boolean;
  reached_analyze: boolean;
  completed_analyze: boolean;
  reached_topics: boolean;
  reached_prompts: boolean;
  reached_plans: boolean;
  started_checkout: boolean;
  last_activity_at: string | null;
  last_step: string;
  days_since_signup: number;
}

interface EngagementRow {
  log_date: string;
  event_type: string;
  event_action: string;
  event_target: string | null;
  event_count: number;
  unique_users: number;
  unique_tenants: number;
  unique_sessions: number;
}

interface DropoffUser {
  user_id: string;
  email: string;
  full_name: string | null;
  signup_at: string;
  tenant_name: string | null;
  has_plan: boolean;
  has_seen_onboarding: boolean;
  last_event_type: string | null;
  last_event_action: string | null;
  last_event_target: string | null;
  last_event_at: string | null;
  total_events: number;
  hours_since_last_activity: number;
}

interface TimelineEvent {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  session_id: string;
  event_type: string;
  event_action: string;
  event_target: string | null;
  metadata: Record<string, unknown> | null;
  page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_address: string | null;
  screen_resolution: string | null;
  locale: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
  tenant_name: string | null;
}

interface ActivityStats {
  total_events: number;
  unique_users: number;
  unique_sessions: number;
  unique_tenants: number;
  anonymous_events: number;
  authenticated_events: number;
  events_today: number;
  users_today: number;
  sessions_today: number;
  top_events: { event_type: string; event_action: string; cnt: number }[];
  daily: { log_date: string; events: number; users: number; sessions: number }[];
  top_pages: { page: string; views: number }[];
}

interface AnalyticsData {
  funnel: FunnelUser[];
  engagement: EngagementRow[];
  dropoffs: DropoffUser[];
  stats: ActivityStats | null;
  recentEvents: TimelineEvent[];
}

/* ─── Funnel Steps Config ─── */

const FUNNEL_STEPS = [
  { key: 'signup_only', label: 'Signed Up', color: 'var(--text-muted)' },
  { key: 'welcome', label: 'Welcome', color: 'var(--chart-cyan)' },
  { key: 'analyze', label: 'Analyze', color: 'var(--brand-primary)' },
  { key: 'analyze_done', label: 'Analysis Done', color: 'var(--brand-primary)' },
  { key: 'topics', label: 'Topics', color: 'var(--brand-accent)' },
  { key: 'prompts', label: 'Prompts', color: 'var(--brand-accent)' },
  { key: 'plans', label: 'Plans', color: 'var(--warning)' },
  { key: 'checkout', label: 'Checkout', color: 'var(--warning)' },
  { key: 'activated', label: 'Activated', color: 'var(--success)' },
] as const;

/* ─── Skeleton ─── */
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-glass-element rounded-md ${className}`} />;
}

/* ─── Main Component ─── */

export function AnalyticsPage() {
  const navigate = useNavigate();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'funnel' | 'events' | 'dropoffs'>('overview');
  const [days, setDays] = useState(30);
  const [eventFilter, setEventFilter] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<AnalyticsData>(`/admin-analytics?days=${days}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Funnel Metrics ──
  const funnelMetrics = useMemo(() => {
    if (!data?.funnel) return null;
    const counts: Record<string, number> = {};
    FUNNEL_STEPS.forEach(s => { counts[s.key] = 0; });
    data.funnel.forEach(u => { counts[u.last_step] = (counts[u.last_step] ?? 0) + 1; });

    // Cumulative: users who reached step X = users at step X + all users at later steps
    const cumulative: { key: string; label: string; color: string; count: number; cumCount: number; pct: number }[] = [];
    let runningFromEnd = 0;
    for (let i = FUNNEL_STEPS.length - 1; i >= 0; i--) {
      runningFromEnd += counts[FUNNEL_STEPS[i].key] || 0;
    }
    const total = data.funnel.length;
    let cumFromTop = 0;
    for (const step of FUNNEL_STEPS) {
      cumFromTop += counts[step.key] || 0;
      const reached = total - cumFromTop + (counts[step.key] || 0);
      cumulative.push({
        key: step.key,
        label: step.label,
        color: step.color,
        count: counts[step.key] || 0,
        cumCount: reached,
        pct: total > 0 ? (reached / total) * 100 : 0,
      });
    }
    return { counts, cumulative, total };
  }, [data?.funnel]);

  // ── Filtered Events ──
  const filteredEvents = useMemo(() => {
    if (!data?.recentEvents) return [];
    if (!eventFilter) return data.recentEvents;
    const q = eventFilter.toLowerCase();
    return data.recentEvents.filter(e =>
      e.event_type.toLowerCase().includes(q) ||
      e.event_action.toLowerCase().includes(q) ||
      (e.event_target || '').toLowerCase().includes(q) ||
      (e.user_email || '').toLowerCase().includes(q) ||
      (e.user_name || '').toLowerCase().includes(q)
    );
  }, [data?.recentEvents, eventFilter]);

  // ── Loading ──
  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dashboard-card p-6 border-error border bg-error/5">
        <h3 className="text-error font-medium">Failed to load analytics</h3>
        <p className="text-sm text-error/80 mt-1">{error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <SAPageHeader
        title="User Analytics"
        subtitle="Track every visitor, from landing page to activation"
        icon={<Activity className="w-6 h-6 text-brand-primary" />}
      >
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="input text-xs py-1.5 px-2 min-w-0 w-auto"
          >
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
          </select>
          <button
            onClick={fetchData}
            className="btn btn-ghost btn-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </SAPageHeader>

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            icon={<Eye className="w-4 h-4" />}
            label="Total Events"
            value={stats.total_events.toLocaleString()}
            subValue={`${stats.events_today} today`}
          />
          <KPICard
            icon={<Users className="w-4 h-4" />}
            label="Unique Users"
            value={stats.unique_users.toString()}
            subValue={`${stats.users_today} today`}
            valueColor="text-brand-primary"
          />
          <KPICard
            icon={<Globe className="w-4 h-4" />}
            label="Sessions"
            value={stats.unique_sessions.toLocaleString()}
            subValue={`${stats.sessions_today} today`}
            valueColor="text-chart-cyan"
          />
          <KPICard
            icon={<Layers className="w-4 h-4" />}
            label="Tenants"
            value={stats.unique_tenants.toString()}
            valueColor="text-brand-accent"
          />
          <KPICard
            icon={<MousePointerClick className="w-4 h-4" />}
            label="Authenticated"
            value={stats.authenticated_events.toLocaleString()}
            valueColor="text-success"
          />
          <KPICard
            icon={<Smartphone className="w-4 h-4" />}
            label="Anonymous"
            value={stats.anonymous_events.toLocaleString()}
            valueColor="text-warning"
          />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-glass-border overflow-x-auto pb-px">
        {(['overview', 'funnel', 'events', 'dropoffs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'funnel' && `Funnel (${data.funnel.length})`}
            {tab === 'events' && `Live Events (${data.recentEvents.length})`}
            {tab === 'dropoffs' && `Drop-offs (${data.dropoffs.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab stats={stats} engagement={data.engagement} />
      )}

      {activeTab === 'funnel' && funnelMetrics && (
        <FunnelTab
          funnel={data.funnel}
          metrics={funnelMetrics}
          onViewUser={(userId) => navigate(`/sa/users/${userId}`)}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          events={filteredEvents}
          filter={eventFilter}
          onFilterChange={setEventFilter}
          onViewUser={(userId) => navigate(`/sa/users/${userId}`)}
        />
      )}

      {activeTab === 'dropoffs' && (
        <DropoffsTab
          dropoffs={data.dropoffs}
          onViewUser={(userId) => navigate(`/sa/users/${userId}`)}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   TAB: Overview
   ═════════════════════════════════════════════════════════════ */

function OverviewTab({ stats, engagement }: { stats: ActivityStats | null; engagement: EngagementRow[] }) {
  if (!stats) return <div className="text-text-muted text-center py-12">No data yet</div>;

  // Daily activity chart (simple bar chart with CSS)
  const maxEvents = Math.max(...(stats.daily?.map(d => d.events) ?? [1]), 1);

  // Aggregate engagement by event_type
  const engagementByType = useMemo(() => {
    const map = new Map<string, { count: number; users: number }>();
    engagement.forEach(e => {
      const key = `${e.event_type}`;
      const existing = map.get(key) || { count: 0, users: 0 };
      existing.count += e.event_count;
      existing.users = Math.max(existing.users, e.unique_users);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [engagement]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Activity Chart */}
      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-primary" />
            Daily Activity
          </h3>
          <span className="text-xs text-text-muted">{stats.daily?.length || 0} days</span>
        </div>
        {stats.daily && stats.daily.length > 0 ? (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {stats.daily.map(day => (
              <div key={day.log_date} className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted font-mono w-16 shrink-0">
                  {formatDate(day.log_date, 'shortDate')}
                </span>
                <div className="flex-1 h-5 rounded bg-bg-secondary overflow-hidden relative">
                  <div
                    className="h-full rounded bg-gradient-to-r from-brand-primary/80 to-brand-accent/80 transition-all duration-500"
                    style={{ width: `${(day.events / maxEvents) * 100}%` }}
                  />
                  <span className="absolute right-1.5 top-0.5 text-[9px] font-semibold text-text-primary">
                    {day.events}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-text-muted w-16 shrink-0 justify-end">
                  <Users className="w-3 h-3" />
                  {day.users}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-text-muted py-12 text-sm">No activity data</div>
        )}
      </div>

      {/* Top Pages */}
      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Globe className="w-4 h-4 text-chart-cyan" />
            Top Pages
          </h3>
        </div>
        {stats.top_pages && stats.top_pages.length > 0 ? (
          <div className="space-y-2">
            {stats.top_pages.map((p, i) => {
              const maxViews = stats.top_pages?.[0]?.views ?? 1;
              return (
                <div key={p.page} className="flex items-center gap-3">
                  <span className="w-5 text-[10px] text-text-muted font-mono text-right shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary truncate font-mono">{p.page}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-bg-secondary mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-chart-cyan/70 transition-all duration-500"
                        style={{ width: `${(p.views / maxViews) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-text-primary shrink-0">{p.views}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-text-muted py-12 text-sm">No page data</div>
        )}
      </div>

      {/* Event Breakdown */}
      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-brand-accent" />
            Event Types
          </h3>
        </div>
        {stats.top_events && stats.top_events.length > 0 ? (
          <div className="space-y-2">
            {stats.top_events.map(e => {
              const max = stats.top_events?.[0]?.cnt ?? 1;
              return (
                <div key={`${e.event_type}-${e.event_action}`} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <EventBadge type={e.event_type} />
                      <span className="text-xs text-text-secondary truncate">{e.event_action}</span>
                    </div>
                    <div className="h-1 rounded-full bg-bg-secondary mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-accent/60 transition-all duration-500"
                        style={{ width: `${(e.cnt / max) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-text-primary shrink-0">{e.cnt}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-text-muted py-12 text-sm">No event data</div>
        )}
      </div>

      {/* Engagement Summary */}
      <div className="dashboard-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" />
            Engagement by Category
          </h3>
        </div>
        {engagementByType.length > 0 ? (
          <div className="space-y-2.5">
            {engagementByType.map(([key, val]) => {
              const max = engagementByType[0]?.[1]?.count ?? 1;
              return (
                <div key={key} className="flex items-center gap-3">
                  <EventBadge type={key} />
                  <div className="flex-1 h-2 rounded-full bg-bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-success/60 transition-all duration-500"
                      style={{ width: `${(val.count / max) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-text-primary">{val.count}</span>
                    <span className="text-[9px] text-text-muted flex items-center gap-0.5">
                      <Users className="w-2.5 h-2.5" />{val.users}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-text-muted py-12 text-sm">No engagement data</div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   TAB: Funnel
   ═════════════════════════════════════════════════════════════ */

interface FunnelMetrics {
  counts: Record<string, number>;
  cumulative: { key: string; label: string; color: string; count: number; cumCount: number; pct: number }[];
  total: number;
}

function FunnelTab({
  funnel,
  metrics,
  onViewUser,
}: {
  funnel: FunnelUser[];
  metrics: FunnelMetrics;
  onViewUser: (userId: string) => void;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Visual Funnel */}
      <div className="dashboard-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-primary" />
          Onboarding Funnel — {metrics.total} users
        </h3>
        <div className="space-y-2">
          {metrics.cumulative.map((step, i) => {
            const prevPct = i > 0 ? metrics.cumulative[i - 1].pct : 100;
            const dropoff = i > 0 ? prevPct - step.pct : 0;
            const usersAtStep = funnel.filter(u => u.last_step === step.key);

            return (
              <div key={step.key}>
                <button
                  className="w-full text-left group"
                  onClick={() => setExpandedStep(expandedStep === step.key ? null : step.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-right">
                      <span className="text-xs font-semibold" style={{ color: step.color }}>{step.label}</span>
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-8 rounded bg-bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded transition-all duration-700 flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.max(step.pct, 2)}%`,
                            background: `linear-gradient(90deg, ${step.color}33, ${step.color}66)`,
                            borderRight: `3px solid ${step.color}`,
                          }}
                        >
                          {step.pct >= 15 && (
                            <span className="text-[10px] font-bold text-text-primary">{step.pct.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-16 shrink-0 text-right flex items-center justify-end gap-1">
                      <span className="text-sm font-bold text-text-primary">{step.count}</span>
                      {dropoff > 0 && (
                        <span className="text-[9px] text-error flex items-center">
                          <ArrowDownRight className="w-2.5 h-2.5" />
                          {dropoff.toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-text-muted transition-transform ${expandedStep === step.key ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded: show users at this step */}
                {expandedStep === step.key && usersAtStep.length > 0 && (
                  <div className="ml-24 mt-2 mb-3 space-y-1 max-h-48 overflow-y-auto pr-1">
                    {usersAtStep.map(u => (
                      <div
                        key={u.user_id}
                        className="flex items-center gap-2 text-xs p-2 rounded-md bg-bg-secondary/60 hover:bg-glass-hover cursor-pointer transition-colors"
                        onClick={() => onViewUser(u.user_id)}
                      >
                        <User className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="text-text-primary font-medium truncate">{u.full_name || u.email}</span>
                        <span className="text-text-muted truncate">{u.email}</span>
                        <span className="ml-auto text-text-muted whitespace-nowrap">
                          {u.days_since_signup}d ago
                        </span>
                        <ChevronRight className="w-3 h-3 text-text-muted" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Funnel Table */}
      <div className="dashboard-card overflow-hidden">
        <div className="px-5 py-4 border-b border-glass-border">
          <h3 className="text-sm font-semibold text-text-primary">All Users — Onboarding Progress</h3>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-glass-border">
          {funnel.slice(0, 30).map(u => (
            <div
              key={u.user_id}
              className="px-4 py-3 hover:bg-glass-hover cursor-pointer transition-colors"
              onClick={() => onViewUser(u.user_id)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{u.full_name || 'Unnamed'}</div>
                  <div className="text-xs text-text-muted truncate">{u.email}</div>
                </div>
                <StepBadge step={u.last_step} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted">
                <span>{u.days_since_signup}d ago</span>
                <span>{u.tenant_name || '—'}</span>
                {u.has_plan && <span className="text-success font-semibold">✓ Plan</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-text-muted bg-bg-secondary/50 border-b border-glass-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
                <th className="px-4 py-2.5 text-center font-medium">Last Step</th>
                <th className="px-4 py-2.5 text-center font-medium">Welcome</th>
                <th className="px-4 py-2.5 text-center font-medium">Analyze</th>
                <th className="px-4 py-2.5 text-center font-medium">Topics</th>
                <th className="px-4 py-2.5 text-center font-medium">Plans</th>
                <th className="px-4 py-2.5 text-center font-medium">Checkout</th>
                <th className="px-4 py-2.5 text-center font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {funnel.slice(0, 50).map(u => (
                <tr
                  key={u.user_id}
                  className="hover:bg-glass-hover cursor-pointer transition-colors"
                  onClick={() => onViewUser(u.user_id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-text-primary truncate max-w-[180px]">{u.full_name || 'Unnamed'}</div>
                    <div className="text-xs text-text-muted truncate max-w-[180px]">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{u.tenant_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center"><StepBadge step={u.last_step} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.reached_welcome} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.completed_analyze} partial={u.reached_analyze} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.reached_topics} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.reached_plans} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.started_checkout} /></td>
                  <td className="px-4 py-2.5 text-center"><StepCheck ok={u.has_plan} /></td>
                  <td className="px-4 py-2.5 text-right text-text-muted text-xs">{u.days_since_signup}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   TAB: Events (Live Feed)
   ═════════════════════════════════════════════════════════════ */

function EventsTab({
  events,
  filter,
  onFilterChange,
  onViewUser,
}: {
  events: TimelineEvent[];
  filter: string;
  onFilterChange: (v: string) => void;
  onViewUser: (userId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder="Filter events..."
            className="input pl-9 text-sm"
          />
        </div>
        <span className="text-xs text-text-muted">{events.length} events</span>
      </div>

      {/* Events List */}
      <div className="dashboard-card overflow-hidden divide-y divide-glass-border">
        {events.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">No events match your filter</div>
        ) : events.map(ev => (
          <div
            key={ev.id}
            className="px-4 py-3 hover:bg-glass-hover transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                ev.user_id ? 'bg-brand-primary/10 border border-brand-primary/20' : 'bg-text-muted/10 border border-text-muted/20'
              }`}>
                {ev.user_id
                  ? <User className="w-3.5 h-3.5 text-brand-primary" />
                  : <Globe className="w-3.5 h-3.5 text-text-muted" />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <EventBadge type={ev.event_type} />
                  <span className="text-xs text-text-secondary font-medium">{ev.event_action}</span>
                  {ev.event_target && (
                    <span className="text-xs text-text-muted font-mono truncate">{ev.event_target}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted flex-wrap">
                  {ev.user_email ? (
                    <button
                      className="text-brand-primary hover:underline"
                      onClick={() => ev.user_id && onViewUser(ev.user_id)}
                    >
                      {ev.user_name || ev.user_email}
                    </button>
                  ) : (
                    <span className="italic">Anonymous</span>
                  )}
                  {ev.ip_address && <span>• {ev.ip_address}</span>}
                  {ev.screen_resolution && <span>• {ev.screen_resolution}</span>}
                  {ev.locale && <span>• {ev.locale}</span>}
                </div>
                {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                  <div className="mt-1 text-[10px] text-text-muted font-mono bg-bg-secondary/50 rounded px-2 py-1 inline-block max-w-full overflow-hidden">
                    {JSON.stringify(ev.metadata).slice(0, 120)}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-text-muted whitespace-nowrap shrink-0">
                {formatDateTime(ev.created_at, 'dateTimeSeconds')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   TAB: Drop-offs
   ═════════════════════════════════════════════════════════════ */

function DropoffsTab({
  dropoffs,
  onViewUser,
}: {
  dropoffs: DropoffUser[];
  onViewUser: (userId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <AlertTriangle className="w-4 h-4 text-warning" />
        Users who signed up but have not activated a plan yet
      </div>

      <div className="dashboard-card overflow-hidden">
        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-glass-border">
          {dropoffs.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">No drop-offs 🎉</div>
          ) : dropoffs.map(u => (
            <div
              key={u.user_id}
              className="px-4 py-3 hover:bg-glass-hover cursor-pointer transition-colors"
              onClick={() => onViewUser(u.user_id)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{u.full_name || 'Unnamed'}</div>
                  <div className="text-xs text-text-muted truncate">{u.email}</div>
                </div>
                <StaleBadge hours={u.hours_since_last_activity} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted flex-wrap">
                {u.last_event_type && (
                  <span>Last: <strong>{u.last_event_type}/{u.last_event_action}</strong></span>
                )}
                <span>{u.total_events} events</span>
                <span>{u.tenant_name || '—'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-text-muted bg-bg-secondary/50 border-b border-glass-border">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">User</th>
                <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
                <th className="px-4 py-2.5 text-left font-medium">Last Event</th>
                <th className="px-4 py-2.5 text-center font-medium">Events</th>
                <th className="px-4 py-2.5 text-center font-medium">Onboarding</th>
                <th className="px-4 py-2.5 text-right font-medium">Inactive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {dropoffs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">No drop-offs 🎉</td></tr>
              ) : dropoffs.map(u => (
                <tr
                  key={u.user_id}
                  className="hover:bg-glass-hover cursor-pointer transition-colors"
                  onClick={() => onViewUser(u.user_id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-text-primary truncate max-w-[180px]">{u.full_name || 'Unnamed'}</div>
                    <div className="text-xs text-text-muted truncate max-w-[180px]">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{u.tenant_name || '—'}</td>
                  <td className="px-4 py-2.5">
                    {u.last_event_type ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <EventBadge type={u.last_event_type} />
                          <span className="text-xs text-text-secondary">{u.last_event_action}</span>
                        </div>
                        {u.last_event_at && (
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {formatDateTime(u.last_event_at, 'dateTime')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted italic">No events</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-sm font-semibold text-text-primary">{u.total_events}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {u.has_seen_onboarding
                      ? <span className="text-success text-xs font-semibold">Yes</span>
                      : <span className="text-text-muted text-xs">No</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <StaleBadge hours={u.hours_since_last_activity} />
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

/* ═════════════════════════════════════════════════════════════
   Shared Components
   ═════════════════════════════════════════════════════════════ */

function KPICard({
  icon, label, value, subValue, valueColor = 'text-text-primary', trend,
}: {
  icon: React.ReactNode; label: string; value: string; subValue?: string;
  valueColor?: string; trend?: 'up' | 'down';
}) {
  return (
    <div className="dashboard-card p-3.5 relative overflow-hidden">
      <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
        {icon}
        <span className="text-[10px] font-medium truncate">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
        {trend && (
          trend === 'up'
            ? <ArrowUpRight className="w-3 h-3 text-success mb-0.5" />
            : <ArrowDownRight className="w-3 h-3 text-error mb-0.5" />
        )}
      </div>
      {subValue && <p className="text-[9px] text-text-muted mt-0.5 truncate">{subValue}</p>}
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    page_view: 'bg-chart-cyan/15 text-chart-cyan',
    landing_section: 'bg-brand-primary/15 text-brand-primary',
    signup_form: 'bg-success/15 text-success',
    signin_form: 'bg-brand-accent/15 text-brand-accent',
    onboarding_step: 'bg-warning/15 text-warning',
    onboarding_analyze: 'bg-warning/15 text-warning',
    onboarding_plan: 'bg-warning/15 text-warning',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
      colors[type] || 'bg-text-muted/15 text-text-muted'
    }`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
}

function StepBadge({ step }: { step: string }) {
  const config = FUNNEL_STEPS.find(s => s.key === step);
  if (!config) return <span className="text-xs text-text-muted">{step}</span>;

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: `${config.color}22`,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}

function StepCheck({ ok, partial }: { ok: boolean; partial?: boolean }) {
  if (ok) return <span className="text-success text-xs">●</span>;
  if (partial) return <span className="text-warning text-xs">◐</span>;
  return <span className="text-text-muted/30 text-xs">○</span>;
}

function StaleBadge({ hours }: { hours: number }) {
  const days = Math.floor(hours / 24);
  const isStale = hours > 48;
  const isCritical = hours > 168; // 7 days

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      isCritical ? 'bg-error/15 text-error' :
      isStale ? 'bg-warning/15 text-warning' :
      'bg-text-muted/15 text-text-muted'
    }`}>
      <Timer className="w-2.5 h-2.5" />
      {days > 0 ? `${days}d` : `${hours}h`}
    </span>
  );
}
