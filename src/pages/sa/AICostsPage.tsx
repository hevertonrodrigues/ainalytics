import { useState, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, Activity, Zap, Users, Clock, AlertTriangle,
  ChevronDown, ChevronUp, BarChart3, TrendingUp, Server, Layers,
  RefreshCw, Hash, Cpu, Globe,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────
interface Summary {
  total_requests: number;
  total_tenants: number;
  total_models_used: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_tokens: number;
  total_cost_usd: number;
  cost_input_usd: number;
  cost_output_usd: number;
  avg_latency_ms: number | null;
  error_count: number;
  error_rate: number;
  avg_cost_per_request: number;
}

interface TenantRow {
  tenant_id: string;
  tenant_name: string;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  models_used: string[];
  call_sites: string[];
  first_request: string;
  last_request: string;
}

interface ModelRow {
  platform_slug: string;
  model_slug: string;
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  cost_input_usd: number;
  cost_output_usd: number;
  avg_latency_ms: number | null;
}

interface CallSiteRow {
  call_site: string;
  total_requests: number;
  total_errors: number;
  error_rate: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
  models_used: string[];
}

interface DailyRow {
  date: string;
  total_requests: number;
  total_cost_usd: number;
  total_tokens: number;
  by_platform: Record<string, number>;
}

interface RecentRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  call_site: string;
  platform_slug: string;
  model_slug: string;
  tokens_input: number;
  tokens_output: number;
  cost_total_usd: string;
  latency_ms: number | null;
  error: string | null;
  web_search_enabled: boolean;
  created_at: string;
}

interface RecentResponse {
  items: RecentRow[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

type TabId = 'overview' | 'tenants' | 'models' | 'callsites' | 'logs';

// Format helpers
function fmtCost(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Platform badge colors
const PLATFORM_COLORS: Record<string, string> = {
  openai: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  anthropic: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  gemini: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  grok: 'bg-red-500/15 text-red-400 border-red-500/20',
  perplexity: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

// Call site friendly names
const CALLSITE_LABELS: Record<string, string> = {
  prompt_execution: 'Prompt Execution',
  llm_extract_website: 'Website Extraction',
  llm_generate_text: 'LLM Text Generation',
  suggest_topics: 'Topic Suggestions',
  deep_analyze: 'Deep Analyze',
  scrape_analyze: 'Company Analysis',
  scrape_deep_analyze: 'Company Deep Analyze',
  insights: 'Insights Generation',
};

// ─── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="dashboard-card p-4 sm:p-5 group hover:border-brand-primary/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${accent || 'bg-brand-primary/10'}`}>
          <Icon className={`w-4 h-4 ${accent?.includes('text-') ? '' : 'text-brand-primary'}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary font-display tracking-tight">{value}</p>
      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      {sub && <p className="text-[0.65rem] text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

// ─── Cost Bar (mini chart) ─────────────────────────────────
function CostBar({ data, maxCost }: { data: DailyRow[]; maxCost: number }) {
  if (data.length === 0) return <div className="text-sm text-text-muted text-center py-8">No data for this period</div>;

  return (
    <div className="flex items-end gap-[2px] h-32 px-1">
      {data.map((d, i) => {
        const h = maxCost > 0 ? (d.total_cost_usd / maxCost) * 100 : 0;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full rounded-t-sm bg-brand-primary/40 group-hover:bg-brand-primary/70 transition-all duration-200 min-h-[2px]"
              style={{ height: `${Math.max(h, 2)}%` }}
            />
            <div className="absolute -top-10 bg-bg-elevated border border-glass-border rounded-md px-2 py-1 text-[0.6rem] text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
              {fmtShortDate(d.date)} · {fmtCost(d.total_cost_usd)} · {d.total_requests} reqs
            </div>
            {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
              <span className="text-[0.55rem] text-text-muted mt-1 truncate w-full text-center">
                {d.date.substring(5)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export function AICostsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [months, setMonths] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tenantData, setTenantData] = useState<TenantRow[]>([]);
  const [modelData, setModelData] = useState<ModelRow[]>([]);
  const [callsiteData, setCallsiteData] = useState<CallSiteRow[]>([]);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [recentData, setRecentData] = useState<RecentResponse | null>(null);
  const [recentPage, setRecentPage] = useState(1);

  // Expansion state
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: TabId, pg = 1) => {
    setIsLoading(true);
    try {
      if (tab === 'overview') {
        const [summaryRes, dailyRes] = await Promise.all([
          apiClient.get<Summary>(`/admin-ai-costs?view=summary&months=${months}`),
          apiClient.get<DailyRow[]>(`/admin-ai-costs?view=daily&months=${months}`),
        ]);
        setSummary(summaryRes.data);
        setDailyData(dailyRes.data);
      } else if (tab === 'tenants') {
        const res = await apiClient.get<TenantRow[]>(`/admin-ai-costs?view=by_tenant&months=${months}`);
        setTenantData(res.data);
      } else if (tab === 'models') {
        const res = await apiClient.get<ModelRow[]>(`/admin-ai-costs?view=by_model&months=${months}`);
        setModelData(res.data);
      } else if (tab === 'callsites') {
        const res = await apiClient.get<CallSiteRow[]>(`/admin-ai-costs?view=by_callsite&months=${months}`);
        setCallsiteData(res.data);
      } else if (tab === 'logs') {
        const res = await apiClient.get<RecentResponse>(`/admin-ai-costs?view=recent&months=${months}&page=${pg}&per_page=30`);
        setRecentData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch AI cost data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(activeTab, recentPage); }, [activeTab, months, fetchData, recentPage]);

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t('sa.costs.overview'), icon: BarChart3 },
    { id: 'tenants', label: t('sa.costs.byTenant'), icon: Users },
    { id: 'models', label: t('sa.costs.byModel'), icon: Cpu },
    { id: 'callsites', label: t('sa.costs.byCallSite'), icon: Layers },
    { id: 'logs', label: t('sa.costs.recentLogs'), icon: Activity },
  ];

  const Skeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="dashboard-card p-6 h-20 animate-pulse bg-glass-element" />
      ))}
    </div>
  );

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-brand-primary" />
            {t('sa.costs.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.costs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={e => setMonths(parseInt(e.target.value))}
            className="input-field !py-2 !text-sm w-36"
          >
            <option value={1}>{t('sa.costs.last30Days')}</option>
            <option value={3}>{t('sa.costs.last90Days')}</option>
            <option value={6}>{t('sa.costs.last6Months')}</option>
            <option value={12}>{t('sa.costs.lastYear')}</option>
          </select>
          <button
            onClick={() => fetchData(activeTab, recentPage)}
            className="icon-btn"
            title={t('sa.costs.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-glass-border overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-glass-border'
              }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {isLoading ? <Skeleton /> : (
        <>
          {/* ─── OVERVIEW TAB ─────────────────────────────── */}
          {activeTab === 'overview' && summary && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard icon={DollarSign} label={t('sa.costs.totalCost')} value={fmtCost(summary.total_cost_usd)} sub={`${t('sa.costs.input')}: ${fmtCost(summary.cost_input_usd)} · ${t('sa.costs.output')}: ${fmtCost(summary.cost_output_usd)}`} accent="bg-brand-accent/10 text-brand-accent" />
                <KpiCard icon={Zap} label={t('sa.costs.totalRequests')} value={summary.total_requests.toLocaleString()} sub={`${fmtCost(summary.avg_cost_per_request)} ${t('sa.costs.perRequest')}`} />
                <KpiCard icon={Hash} label={t('sa.costs.totalTokens')} value={fmtTokens(summary.total_tokens)} sub={`${t('sa.costs.input')}: ${fmtTokens(summary.total_tokens_input)} · ${t('sa.costs.output')}: ${fmtTokens(summary.total_tokens_output)}`} />
                <KpiCard icon={Users} label={t('sa.costs.activeTenants')} value={summary.total_tenants.toString()} />
                <KpiCard icon={Clock} label={t('sa.costs.avgLatency')} value={fmtMs(summary.avg_latency_ms)} />
                <KpiCard icon={AlertTriangle} label={t('sa.costs.errorRate')} value={`${summary.error_rate}%`} sub={`${summary.error_count} ${t('sa.costs.errors')}`} accent={summary.error_rate > 5 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'} />
              </div>

              {/* Daily Chart */}
              <div className="dashboard-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-primary" />
                    {t('sa.costs.dailyCosts')}
                  </h3>
                  <span className="text-xs text-text-muted">{dailyData.length} {t('sa.costs.days')}</span>
                </div>
                <CostBar data={dailyData} maxCost={Math.max(...dailyData.map(d => d.total_cost_usd), 0.000001)} />
              </div>

              {/* Platform cost split (horizontal stacked bar) */}
              {dailyData.length > 0 && (() => {
                const platformTotals: Record<string, number> = {};
                for (const d of dailyData) {
                  for (const [p, c] of Object.entries(d.by_platform)) {
                    platformTotals[p] = (platformTotals[p] || 0) + c;
                  }
                }
                const total = Object.values(platformTotals).reduce((a, b) => a + b, 0);
                const sorted = Object.entries(platformTotals).sort((a, b) => b[1] - a[1]);

                return (
                  <div className="dashboard-card p-5">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                      <Globe className="w-4 h-4 text-brand-primary" />
                      {t('sa.costs.costByPlatform')}
                    </h3>
                    <div className="space-y-2">
                      {sorted.map(([platform, cost]) => {
                        const pct = total > 0 ? (cost / total) * 100 : 0;
                        const colors = PLATFORM_COLORS[platform] || 'bg-text-muted/15 text-text-secondary';
                        return (
                          <div key={platform} className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors} w-24 text-center capitalize`}>
                              {platform}
                            </span>
                            <div className="flex-1 h-5 bg-glass-bg rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-brand-primary/50 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-text-primary w-20 text-right">{fmtCost(cost)}</span>
                            <span className="text-xs text-text-muted w-12 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─── TENANTS TAB ──────────────────────────────── */}
          {activeTab === 'tenants' && (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t('sa.costs.tenant')}</th>
                    <th className="text-right">{t('sa.costs.requests')}</th>
                    <th className="text-right">{t('sa.costs.tokensIn')}</th>
                    <th className="text-right">{t('sa.costs.tokensOut')}</th>
                    <th className="text-right">{t('sa.costs.cost')}</th>
                    <th className="text-right">{t('sa.costs.lastActivity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantData.length === 0 ? (
                    <tr><td colSpan={6} className="!text-center !font-body !text-text-secondary">{t('sa.costs.noData')}</td></tr>
                  ) : tenantData.map(row => {
                    const isExp = expandedTenant === row.tenant_id;
                    return (
                      <Fragment key={row.tenant_id}>
                        <tr className="cursor-pointer" onClick={() => setExpandedTenant(isExp ? null : row.tenant_id)}>
                          <td className="!font-body">
                            <div className="flex items-center gap-2">
                              {isExp ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                              <span className="font-medium text-text-primary">{row.tenant_name}</span>
                            </div>
                          </td>
                          <td className="text-right font-mono text-sm">{row.total_requests.toLocaleString()}</td>
                          <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_input)}</td>
                          <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_output)}</td>
                          <td className="text-right">
                            <span className="font-mono font-semibold text-brand-accent text-sm">{fmtCost(row.total_cost_usd)}</span>
                          </td>
                          <td className="text-right text-sm text-text-secondary">{fmtDate(row.last_request)}</td>
                        </tr>
                        {isExp && (
                          <tr>
                            <td colSpan={6} className="!font-body !text-sm !p-4 bg-bg-tertiary/30">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.costs.modelsUsed')}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {row.models_used.map(m => (
                                      <span key={m} className="text-xs px-1.5 py-0.5 rounded bg-glass-bg border border-glass-border text-brand-primary font-mono">{m}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.costs.callSites')}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {row.call_sites.map(cs => (
                                      <span key={cs} className="text-xs px-1.5 py-0.5 rounded bg-glass-bg border border-glass-border text-text-primary">{CALLSITE_LABELS[cs] || cs}</span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">{t('sa.costs.firstRequest')}</span>
                                  <span className="text-text-primary text-xs">{fmtDate(row.first_request)}</span>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-text-secondary block mb-1">Tenant ID</span>
                                  <code className="text-xs text-text-primary break-all">{row.tenant_id}</code>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── MODELS TAB ───────────────────────────────── */}
          {activeTab === 'models' && (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t('sa.costs.platform')}</th>
                    <th className="text-left">{t('sa.costs.model')}</th>
                    <th className="text-right">{t('sa.costs.requests')}</th>
                    <th className="text-right">{t('sa.costs.tokensIn')}</th>
                    <th className="text-right">{t('sa.costs.tokensOut')}</th>
                    <th className="text-right">{t('sa.costs.costIn')}</th>
                    <th className="text-right">{t('sa.costs.costOut')}</th>
                    <th className="text-right">{t('sa.costs.totalCostCol')}</th>
                    <th className="text-right">{t('sa.costs.avgLatency')}</th>
                  </tr>
                </thead>
                <tbody>
                  {modelData.length === 0 ? (
                    <tr><td colSpan={9} className="!text-center !font-body !text-text-secondary">{t('sa.costs.noData')}</td></tr>
                  ) : modelData.map(row => {
                    const colors = PLATFORM_COLORS[row.platform_slug] || 'bg-text-muted/15 text-text-secondary';
                    return (
                      <tr key={`${row.platform_slug}:${row.model_slug}`}>
                        <td>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors} capitalize`}>
                            {row.platform_slug}
                          </span>
                        </td>
                        <td><code className="text-brand-primary text-xs font-semibold">{row.model_slug}</code></td>
                        <td className="text-right font-mono text-sm">{row.total_requests.toLocaleString()}</td>
                        <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_input)}</td>
                        <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_output)}</td>
                        <td className="text-right font-mono text-sm text-text-secondary">{fmtCost(row.cost_input_usd)}</td>
                        <td className="text-right font-mono text-sm text-text-secondary">{fmtCost(row.cost_output_usd)}</td>
                        <td className="text-right">
                          <span className="font-mono font-semibold text-brand-accent text-sm">{fmtCost(row.total_cost_usd)}</span>
                        </td>
                        <td className="text-right text-sm text-text-secondary">{fmtMs(row.avg_latency_ms)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {modelData.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-glass-border">
                      <td colSpan={2} className="!font-body font-semibold text-text-primary">{t('sa.costs.total')}</td>
                      <td className="text-right font-mono font-semibold text-text-primary">{modelData.reduce((a, b) => a + b.total_requests, 0).toLocaleString()}</td>
                      <td className="text-right font-mono font-semibold text-text-primary">{fmtTokens(modelData.reduce((a, b) => a + b.total_tokens_input, 0))}</td>
                      <td className="text-right font-mono font-semibold text-text-primary">{fmtTokens(modelData.reduce((a, b) => a + b.total_tokens_output, 0))}</td>
                      <td className="text-right font-mono font-semibold text-text-secondary">{fmtCost(modelData.reduce((a, b) => a + b.cost_input_usd, 0))}</td>
                      <td className="text-right font-mono font-semibold text-text-secondary">{fmtCost(modelData.reduce((a, b) => a + b.cost_output_usd, 0))}</td>
                      <td className="text-right font-mono font-bold text-brand-accent">{fmtCost(modelData.reduce((a, b) => a + b.total_cost_usd, 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ─── CALL SITES TAB ───────────────────────────── */}
          {activeTab === 'callsites' && (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t('sa.costs.callSite')}</th>
                    <th className="text-right">{t('sa.costs.requests')}</th>
                    <th className="text-right">{t('sa.costs.errorsCol')}</th>
                    <th className="text-right">{t('sa.costs.errorRate')}</th>
                    <th className="text-right">{t('sa.costs.tokensIn')}</th>
                    <th className="text-right">{t('sa.costs.tokensOut')}</th>
                    <th className="text-right">{t('sa.costs.cost')}</th>
                    <th className="text-right">{t('sa.costs.avgLatency')}</th>
                    <th className="text-left">{t('sa.costs.modelsUsed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {callsiteData.length === 0 ? (
                    <tr><td colSpan={9} className="!text-center !font-body !text-text-secondary">{t('sa.costs.noData')}</td></tr>
                  ) : callsiteData.map(row => (
                    <tr key={row.call_site}>
                      <td className="!font-body font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <Server className="w-3.5 h-3.5 text-brand-primary" />
                          {CALLSITE_LABELS[row.call_site] || row.call_site}
                        </div>
                      </td>
                      <td className="text-right font-mono text-sm">{row.total_requests.toLocaleString()}</td>
                      <td className="text-right font-mono text-sm text-error">{row.total_errors || '—'}</td>
                      <td className="text-right">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          row.error_rate > 10 ? 'bg-error/15 text-error' :
                          row.error_rate > 0 ? 'bg-warning/15 text-warning' :
                          'bg-success/15 text-success'
                        }`}>
                          {row.error_rate}%
                        </span>
                      </td>
                      <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_input)}</td>
                      <td className="text-right font-mono text-sm">{fmtTokens(row.total_tokens_output)}</td>
                      <td className="text-right">
                        <span className="font-mono font-semibold text-brand-accent text-sm">{fmtCost(row.total_cost_usd)}</span>
                      </td>
                      <td className="text-right text-sm text-text-secondary">{fmtMs(row.avg_latency_ms)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.models_used.slice(0, 3).map(m => (
                            <span key={m} className="text-[0.6rem] px-1 py-0.5 rounded bg-glass-bg border border-glass-border text-brand-primary font-mono">{m}</span>
                          ))}
                          {row.models_used.length > 3 && (
                            <span className="text-[0.6rem] text-text-muted">+{row.models_used.length - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── RECENT LOGS TAB ──────────────────────────── */}
          {activeTab === 'logs' && recentData && (
            <div className="space-y-4">
              <div className="dashboard-card overflow-hidden">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-left">{t('sa.costs.time')}</th>
                      <th className="text-left">{t('sa.costs.tenant')}</th>
                      <th className="text-left">{t('sa.costs.callSite')}</th>
                      <th className="text-left">{t('sa.costs.model')}</th>
                      <th className="text-right">{t('sa.costs.tokensIn')}</th>
                      <th className="text-right">{t('sa.costs.tokensOut')}</th>
                      <th className="text-right">{t('sa.costs.cost')}</th>
                      <th className="text-right">{t('sa.costs.latency')}</th>
                      <th className="text-center">{t('sa.costs.statusCol')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentData.items.length === 0 ? (
                      <tr><td colSpan={9} className="!text-center !font-body !text-text-secondary">{t('sa.costs.noData')}</td></tr>
                    ) : recentData.items.map(row => (
                      <tr key={row.id}>
                        <td className="text-sm text-text-secondary whitespace-nowrap">{fmtDate(row.created_at)}</td>
                        <td className="!font-body text-sm font-medium text-text-primary truncate max-w-[120px]">{row.tenant_name}</td>
                        <td className="text-xs text-text-primary">{CALLSITE_LABELS[row.call_site] || row.call_site}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <span className={`text-[0.6rem] px-1.5 py-0.5 rounded-full border ${PLATFORM_COLORS[row.platform_slug] || ''} capitalize`}>
                              {row.platform_slug}
                            </span>
                            <code className="text-[0.65rem] text-brand-primary">{row.model_slug}</code>
                          </div>
                        </td>
                        <td className="text-right font-mono text-xs">{row.tokens_input.toLocaleString()}</td>
                        <td className="text-right font-mono text-xs">{row.tokens_output.toLocaleString()}</td>
                        <td className="text-right font-mono text-xs font-semibold text-brand-accent">{fmtCost(parseFloat(row.cost_total_usd))}</td>
                        <td className="text-right text-xs text-text-secondary">{fmtMs(row.latency_ms)}</td>
                        <td className="text-center">
                          {row.error ? (
                            <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-error/15 text-error font-semibold">Error</span>
                          ) : (
                            <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-semibold">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {recentData.total_pages > 1 && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs text-text-secondary">
                    {t('sa.costs.showing')} {((recentData.page - 1) * recentData.per_page) + 1}–{Math.min(recentData.page * recentData.per_page, recentData.total)} {t('sa.costs.of')} {recentData.total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={recentPage <= 1}
                      onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                      className="btn btn-secondary btn-sm"
                    >
                      ← {t('sa.costs.prev')}
                    </button>
                    <span className="text-xs text-text-secondary px-3">
                      {recentData.page} / {recentData.total_pages}
                    </span>
                    <button
                      disabled={recentPage >= recentData.total_pages}
                      onClick={() => setRecentPage(p => p + 1)}
                      className="btn btn-secondary btn-sm"
                    >
                      {t('sa.costs.next')} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
