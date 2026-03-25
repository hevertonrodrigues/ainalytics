import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  AlertTriangle,
  BarChart3,
  Globe,
  Zap,
  MessageSquare,
  Eye,
  Link2,
  Bot,
  Shield,
  Building2,
  Target,
  Activity,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { PLATFORM_METADATA } from '@/types/dashboard';

// ────────────────────────────────────────────────────────────
// Types for the dashboard-overview edge function response
// ────────────────────────────────────────────────────────────

interface DashboardData {
  company: {
    domain: string;
    company_name: string | null;
    industry: string | null;
    country: string | null;
    tags: string[];
    llm_txt_status: string;
    favicon_url: string | null;
  } | null;
  tenant_name: string | null;
  plan: { name: string } | null;
  geo_analysis: {
    geo_score: number;
    readiness_level: number;
    readiness_label: string | null;
    category_scores: {
      technical: number;
      content: number;
      authority: number;
      semantic: number;
    } | null;
    strengths: string[];
    weaknesses: string[];
    content_quality: string | null;
    structured_data_coverage: string | null;
    pages_crawled: number;
    total_pages: number;
    deep_analyze_score: number | null;
    deep_generic_score: number | null;
    deep_specific_score: number | null;
    completed_at: string | null;
  } | null;
  monitoring: {
    total_topics: number;
    active_topics: number;
    total_prompts: number;
    active_prompts: number;
    total_answers: number;
    total_sources: number;
  };
  platforms: {
    platform: string;
    platform_slug: string;
    model: string;
    model_slug: string;
  }[];
  sources: {
    own_domain: string | null;
    own_domain_rank: number | null;
    own_domain_total_mentions: number;
    total_sources_tracked: number;
    top_competitors: { domain: string; mentions: number }[];
  };
  recent_prompts: {
    id: string;
    text: string;
    is_active: boolean;
    topic_name: string | null;
    created_at: string;
  }[];
  recent_answers: {
    id: string;
    prompt_text: string;
    platform_slug: string;
    model_name: string | null;
    searched_at: string;
  }[];
  insights: {
    overall_health: string;
    health_score: number;
    summary: string;
    created_at: string;
  } | null;
  deep_analyses: {
    final_score: number;
    generic_score: number;
    specific_score: number;
    improvements_count: number;
    created_at: string;
  }[];
}

// ────────────────────────────────────────────────────────────
// Dummy data for SuperAdmin (unchanged)
// ────────────────────────────────────────────────────────────

const KPI_DATA = [
  { key: 'totalDocuments', value: '12,847', change: '+12%', up: true },
  { key: 'detectedErrors', value: '1,230', change: '-8%', up: false },
  { key: 'accuracy', value: '94.7%', change: '+1.2%', up: true },
];

const RISK_DATA = [
  { label: 'Days with High Manual Effort', pct: 72 },
  { label: 'Duplicate Entries', pct: 61 },
  { label: 'Transactions Near Period End', pct: 85 },
  { label: 'Transactions Near Period Start', pct: 54 },
  { label: 'Cash Account Postings', pct: 91 },
  { label: 'Bank & Non-Cash Account Activity', pct: 48 },
];

const DOC_STATUS = [
  { name: 'Invoice Q3', type: 'XML', company: 'Silverline Logistics Co', pct: 79, color: 'magenta' },
  { name: 'Expense Report', type: 'XLSX', company: 'Riverbuild Solutions', pct: 67, color: 'purple' },
  { name: 'Credit Note 21', type: 'PDF', company: 'Trademark Holdings', pct: 82, color: 'cyan' },
  { name: 'Payment Run', type: 'CSV', company: 'Technomatrix Inc', pct: 59, color: 'magenta' },
];

const VOLUME_TABLE = [
  { bucket: '< 100', debit: '-81,986.54', credit: '152,750', net: '70,764' },
  { bucket: '100–1K', debit: '-1,892,268', credit: '2,394,038', net: '501,749' },
  { bucket: '1K–10K', debit: '-14,034,670', credit: '14,631,832', net: '597,432' },
  { bucket: '10K–50K', debit: '-28,197,020', credit: '12,175,620', net: '-221,401' },
  { bucket: '50K–1M', debit: '-3,487,530', credit: '4,129,816', net: '642,286' },
];

const BAR_CHART_DATA = [
  { label: '> 1M', credit: 15, debit: 5 },
  { label: '50K – 1M', credit: 45, debit: 55 },
  { label: '1K – 50K', credit: 20, debit: 15 },
  { label: '< 100', credit: 10, debit: 8 },
];


// ────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────

export function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.is_sa) {
      // SA users get the old dummy dashboard
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }

    // Regular users: fetch dashboard overview
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError(null);
        const { data: resp, error: fetchErr } = await supabase.functions.invoke('dashboard-overview', {
          method: 'GET',
        });

        if (fetchErr) throw fetchErr;
        if (resp?.success === false) throw new Error(resp?.error?.message || 'Failed to load');

        setData(resp?.data || resp);
      } catch (err) {
        console.error('[Dashboard]', err);
        setError((err as Error).message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [profile?.is_sa, currentTenant?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dashboard-card p-5"><div className="skeleton h-20 w-full" /></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="dashboard-card p-6"><div className="skeleton h-48 w-full" /></div>
          <div className="dashboard-card p-6"><div className="skeleton h-48 w-full" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="dashboard-card p-6"><div className="skeleton h-48 w-full" /></div>
          <div className="dashboard-card p-6"><div className="skeleton h-48 w-full" /></div>
        </div>
      </div>
    );
  }

  // SuperAdmin — full analytics dashboard (unchanged)
  if (profile?.is_sa) {
    return (
      <div className="stagger-enter space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {t('dashboard.welcomeUser', { name: profile?.full_name || '' })}
          </h1>
          {currentTenant && (
            <p className="text-sm text-text-muted mt-0.5">{currentTenant.name}</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KPI_DATA.map((kpi) => (
            <KPICard key={kpi.key} kpi={kpi} t={t} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard t={t} />
          <DocumentStatusCard t={t} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskIndicatorsCard t={t} />
          <VolumeTableCard t={t} />
        </div>
      </div>
    );
  }

  // ── Regular users — real dashboard ──────────────────────────
  return (
    <div className="stagger-enter space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {t('dashboard.welcomeUser', { name: profile?.full_name || '' })}
        </h1>
        {currentTenant && (
          <p className="text-sm text-text-muted mt-0.5">{currentTenant.name}</p>
        )}
      </div>

      {error && (
        <div className="dashboard-card p-4 border-error/30">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Company + GEO Score Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CompanyCard data={data} t={t} navigate={navigate} />
            <GeoScoreCard data={data} t={t} navigate={navigate} />
          </div>

          {/* Monitoring KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MonitoringKPI
              icon={<Target className="w-4 h-4" />}
              label={t('dashboard.kpiTopics')}
              value={data.monitoring.active_topics}
              total={data.monitoring.total_topics}
            />
            <MonitoringKPI
              icon={<MessageSquare className="w-4 h-4" />}
              label={t('dashboard.kpiPrompts')}
              value={data.monitoring.active_prompts}
              total={data.monitoring.total_prompts}
            />
            <MonitoringKPI
              icon={<Zap className="w-4 h-4" />}
              label={t('dashboard.kpiAnswers')}
              value={data.monitoring.total_answers}
            />
            <MonitoringKPI
              icon={<Link2 className="w-4 h-4" />}
              label={t('dashboard.kpiSources')}
              value={data.monitoring.total_sources}
            />
            <MonitoringKPI
              icon={<Bot className="w-4 h-4" />}
              label={t('dashboard.kpiPlatforms')}
              value={new Set(data.platforms.map(p => p.platform_slug)).size}
            />
            <MonitoringKPI
              icon={<Eye className="w-4 h-4" />}
              label={t('dashboard.kpiModels')}
              value={data.platforms.length}
            />
          </div>

          {/* Row 2: Platforms + Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PlatformsCard data={data} t={t} navigate={navigate} />
            <SourcesCard data={data} t={t} navigate={navigate} />
          </div>

          {/* Row 3: Recent Prompts + Recent Answers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentPromptsCard data={data} t={t} navigate={navigate} />
            <RecentAnswersCard data={data} t={t} />
          </div>

          {/* Row 4: Health Insights */}
          {data.insights && <InsightsCard data={data} t={t} navigate={navigate} />}
        </>
      )}

      {/* Empty state — no data at all */}
      {!data && !error && (
        <div className="dashboard-card p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-brand-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t('dashboard.emptyTitle')}
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {t('dashboard.emptyDesc')}
          </p>
          <button className="btn btn-primary btn-sm mx-auto" onClick={() => navigate('/dashboard/company')}>
            {t('dashboard.setupCompany')}
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Overview Sub-components
// ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFn = any;

function CompanyCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  const company = data.company;

  if (!company) {
    return (
      <div className="dashboard-card p-6 lg:col-span-1 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-brand-primary" />
        </div>
        <p className="text-sm text-text-secondary">{t('dashboard.noCompanySetup')}</p>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard/company')}>
          {t('dashboard.setupCompany')}
        </button>
      </div>
    );
  }

  const llmStatusColor = {
    updated: 'text-success',
    outdated: 'text-warning',
    missing: 'text-error',
  }[company.llm_txt_status] || 'text-text-muted';

  const llmStatusLabel = {
    updated: t('dashboard.llmUpdated'),
    outdated: t('dashboard.llmOutdated'),
    missing: t('dashboard.llmMissing'),
  }[company.llm_txt_status] || '—';

  return (
    <div className="dashboard-card p-6 lg:col-span-1">
      <div className="card-header">
        <h2 className="card-title">
          <Building2 className="w-4 h-4 text-brand-secondary" />
          {t('dashboard.companyTitle')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/company')}
        >
          {t('common.edit')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {company.favicon_url ? (
            <img src={company.favicon_url} alt="" className="w-8 h-8 rounded" />
          ) : (
            <div className="w-8 h-8 rounded bg-bg-tertiary flex items-center justify-center">
              <Globe className="w-4 h-4 text-text-muted" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{company.company_name || company.domain}</p>
            <p className="text-xs text-text-muted truncate">{company.domain}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {company.industry && (
            <div>
              <span className="text-text-muted">{t('dashboard.industry')}</span>
              <p className="text-text-secondary font-medium truncate">{company.industry}</p>
            </div>
          )}
          {company.country && (
            <div>
              <span className="text-text-muted">{t('dashboard.country')}</span>
              <p className="text-text-secondary font-medium truncate">{company.country}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Shield className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs text-text-muted">llms.txt:</span>
          <span className={`text-xs font-medium ${llmStatusColor}`}>{llmStatusLabel}</span>
        </div>

        {company.tags && company.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {company.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
            {company.tags.length > 4 && (
              <span className="badge">+{company.tags.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GeoScoreCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  const geo = data.geo_analysis;

  if (!geo) {
    return (
      <div className="dashboard-card p-6 lg:col-span-2 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-chart-cyan/10 flex items-center justify-center">
          <Activity className="w-6 h-6 text-chart-cyan" />
        </div>
        <p className="text-sm text-text-secondary">{t('dashboard.noGeoAnalysis')}</p>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/company')}>
          {t('dashboard.runAnalysis')}
        </button>
      </div>
    );
  }

  const score = Math.round(geo.geo_score);
  const scoreColor = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-error';
  const categories = geo.category_scores;
  const deepScore = geo.deep_analyze_score != null ? Math.round(geo.deep_analyze_score) : null;

  return (
    <div className="dashboard-card p-6 lg:col-span-2">
      <div className="card-header">
        <h2 className="card-title">
          <Activity className="w-4 h-4 text-chart-cyan" />
          {t('dashboard.geoScoreTitle')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/company')}
        >
          {t('dashboard.viewDetails')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-6">
        {/* Score Circle */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-bg-tertiary"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                className={scoreColor}
              />
            </svg>
            <span className={`absolute text-2xl font-bold font-mono ${scoreColor}`}>{score}</span>
          </div>
          <span className="text-xs text-text-muted">
            {t('dashboard.geoLevel', { level: geo.readiness_level })}
          </span>
          {deepScore !== null && (
            <span className="text-xs font-mono text-brand-secondary">
              Deep: {deepScore}/100
            </span>
          )}
        </div>

        {/* Category Breakdown */}
        {categories && (
          <div className="flex-1 w-full space-y-3">
            {(['technical', 'content', 'authority', 'semantic'] as const).map((cat) => {
              const val = Math.round(categories[cat] || 0);
              const catLabel = t(`dashboard.geo${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{catLabel}</span>
                    <span className="text-xs font-mono text-text-primary">{val}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill bg-brand-primary"
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MonitoringKPI({ icon, label, value, total }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
}) {
  return (
    <div className="dashboard-card p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold font-mono text-text-primary">{value.toLocaleString()}</span>
        {total !== undefined && total !== value && (
          <span className="text-xs text-text-muted">/ {total}</span>
        )}
      </div>
    </div>
  );
}

function PlatformsCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  const uniquePlatforms = [...new Map(data.platforms.map(p => [p.platform_slug, p])).values()];

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Bot className="w-4 h-4 text-brand-secondary" />
          {t('dashboard.platformsTitle')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/models')}
        >
          {t('dashboard.manage')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {data.platforms.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-text-muted">{t('dashboard.noPlatforms')}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/models')}>
            {t('dashboard.configurePlatforms')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {uniquePlatforms.map((p) => {
            const meta = PLATFORM_METADATA[p.platform_slug];
            const models = data.platforms.filter(m => m.platform_slug === p.platform_slug);
            return (
              <div key={p.platform_slug} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${meta?.colorClass || 'bg-brand-primary'}`}>
                  {(p.platform || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{p.platform}</p>
                  <p className="text-xs text-text-muted truncate">
                    {models.map(m => m.model).join(', ')}
                  </p>
                </div>
                <span className="badge">{models.length} {models.length === 1 ? 'model' : 'models'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourcesCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  const s = data.sources;
  const maxMentions = Math.max(s.own_domain_total_mentions, ...(s.top_competitors.map(c => c.mentions)));

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Link2 className="w-4 h-4 text-chart-cyan" />
          {t('dashboard.sourcesTitle')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/sources')}
        >
          {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {s.total_sources_tracked === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted">{t('dashboard.noSources')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Own domain */}
          {s.own_domain && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-brand-secondary bg-brand-primary/10 px-1.5 py-0.5 rounded">
                #{s.own_domain_rank || '—'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{s.own_domain}</p>
                <div className="progress-bar mt-1">
                  <div
                    className="progress-bar-fill bg-brand-primary"
                    style={{ width: `${maxMentions > 0 ? (s.own_domain_total_mentions / maxMentions) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-text-secondary">{s.own_domain_total_mentions}</span>
            </div>
          )}

          {/* Competitors */}
          {s.top_competitors.slice(0, 4).map((c, i) => (
            <div key={c.domain} className="flex items-center gap-3">
              <span className="text-xs text-text-muted w-6 text-center">
                #{(s.own_domain_rank || 0) + i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-secondary truncate">{c.domain}</p>
                <div className="progress-bar mt-1">
                  <div
                    className="progress-bar-fill bg-chart-magenta"
                    style={{ width: `${maxMentions > 0 ? (c.mentions / maxMentions) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-mono text-text-muted">{c.mentions}</span>
            </div>
          ))}

          <p className="text-xs text-text-muted pt-1">
            {t('dashboard.totalTracked', { count: s.total_sources_tracked })}
          </p>
        </div>
      )}
    </div>
  );
}

function RecentPromptsCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <MessageSquare className="w-4 h-4 text-brand-secondary" />
          {t('dashboard.recentPrompts')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/topics')}
        >
          {t('dashboard.viewAll')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {data.recent_prompts.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <p className="text-sm text-text-muted">{t('dashboard.noPrompts')}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/topics')}>
            {t('dashboard.createPrompts')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.recent_prompts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 group">
              <div className="doc-icon shrink-0 mt-0.5">
                <MessageSquare className="w-3.5 h-3.5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate group-hover:text-brand-secondary transition-colors">{p.text}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.topic_name && <span className="badge">{p.topic_name}</span>}
                  <span className={`text-xs ${p.is_active ? 'text-success' : 'text-text-muted'}`}>
                    {p.is_active ? t('dashboard.active') : t('dashboard.inactive')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentAnswersCard({ data, t }: { data: DashboardData; t: TFn }) {
  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Zap className="w-4 h-4 text-chart-cyan" />
          {t('dashboard.recentAnswers')}
        </h2>
      </div>

      {data.recent_answers.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-text-muted">{t('dashboard.noAnswers')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.recent_answers.map((a) => {
            const meta = PLATFORM_METADATA[a.platform_slug];
            return (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 ${meta?.colorClass || 'bg-brand-primary'}`}>
                  {(a.platform_slug || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{a.prompt_text}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">{meta?.label || a.platform_slug}</span>
                    {a.model_name && <span className="badge">{a.model_name}</span>}
                    <span className="text-xs text-text-muted ml-auto">
                      {new Date(a.searched_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightsCard({ data, t, navigate }: { data: DashboardData; t: TFn; navigate: (path: string) => void }) {
  const ins = data.insights;
  if (!ins) return null;

  const healthColor = {
    good: 'text-success',
    warning: 'text-warning',
    critical: 'text-error',
  }[ins.overall_health] || 'text-text-muted';

  const healthBg = {
    good: 'bg-success/10',
    warning: 'bg-warning/10',
    critical: 'bg-error/10',
  }[ins.overall_health] || 'bg-bg-tertiary';

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Sparkles className="w-4 h-4 text-brand-accent" />
          {t('dashboard.insightsTitle')}
        </h2>
        <button
          className="text-xs text-brand-secondary hover:text-brand-primary transition-colors flex items-center gap-1"
          onClick={() => navigate('/dashboard/insights')}
        >
          {t('dashboard.viewDetails')} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Health Score */}
        <div className="flex items-center gap-4 shrink-0">
          <div className={`w-16 h-16 rounded-xl ${healthBg} flex items-center justify-center`}>
            <span className={`text-2xl font-bold font-mono ${healthColor}`}>
              {ins.health_score}
            </span>
          </div>
          <div>
            <p className="text-xs text-text-muted">{t('dashboard.healthScore')}</p>
            <p className={`text-sm font-semibold ${healthColor}`}>
              {t(`insightsPage.health${ins.overall_health.charAt(0).toUpperCase() + ins.overall_health.slice(1)}`)}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {new Date(ins.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Summary */}
        {ins.summary && (
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary line-clamp-3">{ins.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// SuperAdmin Sub-components (unchanged from original)
// ────────────────────────────────────────────────────────────

function KPICard({ kpi, t }: { kpi: typeof KPI_DATA[number]; t: ReturnType<typeof useTranslation>['t'] }) {
  const labels: Record<string, string> = {
    totalDocuments: t('analytics.totalDocuments'),
    detectedErrors: t('analytics.detectedErrors'),
    accuracy: t('analytics.accuracy'),
  };

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="kpi-label">{labels[kpi.key] || kpi.key}</span>
        <span className={`kpi-trend ${kpi.up ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
          {kpi.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {kpi.change}
        </span>
      </div>
      <p className="kpi-value">{kpi.value}</p>
    </div>
  );
}

function BarChartCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <BarChart3 className="w-4 h-4 text-brand-secondary" />
          {t('analytics.volumeBySize')}
        </h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="legend-dot bg-brand-primary" />
            Credit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="legend-dot bg-chart-magenta" />
            Debit
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {BAR_CHART_DATA.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-20 text-xs text-text-muted font-mono text-right shrink-0">{row.label}</span>
            <div className="flex-1 flex gap-1">
              <div className="chart-bar chart-bar-purple" style={{ width: `${row.credit}%` }} />
              <div className="chart-bar chart-bar-magenta" style={{ width: `${row.debit}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentStatusCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  const colorMap: Record<string, string> = {
    magenta: 'bg-chart-magenta',
    purple: 'bg-brand-primary',
    cyan: 'bg-chart-cyan',
  };

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <FileText className="w-4 h-4 text-brand-secondary" />
          {t('analytics.documentStatus')}
        </h2>
        <span className="text-xs text-success font-medium">+12% Document Review</span>
      </div>
      <div className="space-y-4">
        {DOC_STATUS.map((doc) => (
          <div key={doc.name} className="flex items-center gap-3">
            <div className="doc-icon">
              <FileText className="w-4 h-4 text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">{doc.name}</span>
                <span className="badge">{doc.type}</span>
              </div>
              <span className="text-xs text-text-muted truncate block">{doc.company}</span>
            </div>
            <span className="text-sm font-semibold text-text-primary font-mono w-10 text-right">{doc.pct}%</span>
            <div className="w-20">
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${colorMap[doc.color]}`}
                  style={{ width: `${doc.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskIndicatorsCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <h2 className="card-title mb-5">
        <AlertTriangle className="w-4 h-4 text-chart-magenta" />
        {t('analytics.riskIndicators')}
      </h2>
      <div className="space-y-5">
        {RISK_DATA.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-text-primary">{item.label}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
              <span>Low Risk</span>
              <span>High Risk</span>
            </div>
            <div className="risk-bar">
              <div className="risk-bar-fill" style={{ width: `${item.pct}%` }}>
                <div className="risk-bar-dot" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeTableCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <h2 className="card-title mb-5">
        <BarChart3 className="w-4 h-4 text-brand-secondary" />
        {t('analytics.volumeUSD')}
      </h2>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Size Bucket</th>
              <th className="text-right">Debit (D)</th>
              <th className="text-right">Credit (C)</th>
              <th className="text-right">Net Total</th>
            </tr>
          </thead>
          <tbody>
            {VOLUME_TABLE.map((row) => (
              <tr key={row.bucket}>
                <td className="text-text-secondary">{row.bucket}</td>
                <td className="text-right text-error">{row.debit}</td>
                <td className="text-right text-success">{row.credit}</td>
                <td className={`text-right font-semibold ${
                  row.net.startsWith('-') ? 'text-error' : 'text-text-primary'
                }`}>{row.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
