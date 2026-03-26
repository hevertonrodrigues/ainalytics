import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, DollarSign, TrendingUp, BarChart3, MousePointerClick,
  Eye, Target, Zap, RefreshCw, Settings, Activity, ArrowUpRight,
  ArrowDownRight, AlertTriangle, CheckCircle, XCircle, Loader2,
  Calendar, Clock, CreditCard,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/dateFormat';

// ─── Types ─────────────────────────────────────────────────

interface MetaConfig {
  id: string;
  ad_account_id: string;
  has_token: boolean;
  token_preview: string;
  token_expires_at: string | null;
  api_version: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

interface Overview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_cpc: number;
  avg_cpm: number;
  avg_ctr: number;
  total_conversions: number;
  avg_cost_per_conversion: number;
  currency: string;
  days_count: number;
}

interface DailyRow {
  day: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  avg_cpc: number;
  avg_ctr: number;
  total_conversions: number;
  cost_per_conversion: number;
}

interface ROIData {
  total_ad_spend: number;
  new_subscriptions: number;
  new_mrr: number;
  cac: number;
  roas: number;
  roi_pct: number;
  total_active_mrr: number;
  active_sub_count: number;
  avg_revenue_per_sub: number;
  ltv_estimate: number;
  ltv_cac_ratio: number;
  payback_months: number;
}

type TabId = 'overview' | 'campaigns' | 'roi' | 'settings';

// ─── Helpers ───────────────────────────────────────────────

function fmtCurrency(v: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

// ─── KPI Card ──────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, trend }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="dashboard-card p-4 sm:p-5 group hover:border-brand-primary/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${accent || 'bg-brand-primary/10'}`}>
          <Icon className={`w-4 h-4 ${accent?.includes('text-') ? '' : 'text-brand-primary'}`} />
        </div>
        {trend && (
          trend === 'up'
            ? <ArrowUpRight className="w-4 h-4 text-success" />
            : trend === 'down'
            ? <ArrowDownRight className="w-4 h-4 text-error" />
            : null
        )}
      </div>
      <p className="text-2xl font-bold text-text-primary font-display tracking-tight">{value}</p>
      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
      {sub && <p className="text-[0.65rem] text-text-muted mt-1 break-words">{sub}</p>}
    </div>
  );
}

// ─── Spend (Mini Chart) ────────────────────────────────────

function SpendChart({ data }: { data: DailyRow[] }) {
  if (data.length === 0) return <div className="text-sm text-text-muted text-center py-8">No data for this period</div>;

  const maxSpend = Math.max(...data.map(d => d.spend), 0.01);

  return (
    <div className="flex items-end gap-[2px] h-36 px-1">
      {data.map((d, i) => {
        const h = maxSpend > 0 ? (d.spend / maxSpend) * 100 : 0;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full rounded-t-sm bg-brand-accent/40 group-hover:bg-brand-accent/70 transition-all duration-200 min-h-[2px]"
              style={{ height: `${Math.max(h, 2)}%` }}
            />
            <div className="absolute -top-10 bg-bg-elevated border border-glass-border rounded-md px-2 py-1 text-[0.6rem] text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
              {d.day} · {fmtCurrency(d.spend)} · {fmtNumber(d.clicks)} clicks
            </div>
            {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
              <span className="text-[0.55rem] text-text-muted mt-1 truncate w-full text-center">
                {d.day.substring(5)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export function MetaAdsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [months, setMonths] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [config, setConfig] = useState<MetaConfig | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [roiData, setRoiData] = useState<ROIData | null>(null);

  // Settings form
  const [formAccountId, setFormAccountId] = useState('');
  const [formToken, setFormToken] = useState('');
  const [formApiVersion, setFormApiVersion] = useState('v21.0');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; accountName?: string; error?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (tab: TabId) => {
    setIsLoading(true);
    try {
      if (tab === 'overview') {
        const [overviewRes, dailyRes, configRes] = await Promise.all([
          apiClient.get<Overview>(`/admin-meta-ads?view=overview&months=${months}`),
          apiClient.get<DailyRow[]>(`/admin-meta-ads?view=daily&months=${months}`),
          apiClient.get<MetaConfig>(`/admin-meta-ads?view=config`),
        ]);
        setOverview(overviewRes.data);
        setDailyData(dailyRes.data || []);
        setConfig(configRes.data);
      } else if (tab === 'campaigns') {
        const res = await apiClient.get<CampaignRow[]>(`/admin-meta-ads?view=campaigns&months=${months}`);
        setCampaigns(res.data || []);
      } else if (tab === 'roi') {
        const res = await apiClient.get<ROIData>(`/admin-meta-ads?view=roi&months=${months}`);
        setRoiData(res.data);
      } else if (tab === 'settings') {
        const res = await apiClient.get<MetaConfig>(`/admin-meta-ads?view=config`);
        setConfig(res.data);
        if (res.data) {
          setFormAccountId(res.data.ad_account_id);
          setFormApiVersion(res.data.api_version);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Meta Ads data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(activeTab); }, [activeTab, months, fetchData]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await apiClient.post('/admin-meta-ads?action=save_config', {
        ad_account_id: formAccountId,
        access_token: formToken,
        api_version: formApiVersion,
      });
      setSaveMessage(t('sa.metaAds.configSaved'));
      setFormToken('');
      fetchData('settings');
    } catch {
      setSaveMessage(t('sa.metaAds.configError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post<{ success: boolean; accountName?: string; error?: string }>(
        '/admin-meta-ads?action=test',
        formToken
          ? { ad_account_id: formAccountId, access_token: formToken, api_version: formApiVersion }
          : undefined,
      );
      setTestResult(res.data);
    } catch {
      setTestResult({ success: false, error: 'Connection failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await apiClient.post('/admin-meta-ads?action=sync', { days: months * 30 });
      fetchData(activeTab);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t('sa.metaAds.overview'), icon: BarChart3 },
    { id: 'campaigns', label: t('sa.metaAds.campaigns'), icon: Megaphone },
    { id: 'roi', label: t('sa.metaAds.roiAnalysis'), icon: TrendingUp },
    { id: 'settings', label: t('sa.metaAds.settings'), icon: Settings },
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
            <Megaphone className="w-6 h-6 text-brand-accent" />
            {t('sa.metaAds.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{t('sa.metaAds.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== 'settings' && (
            <>
              <select
                value={months}
                onChange={e => setMonths(parseInt(e.target.value))}
                className="input-field !py-2 !text-sm w-36"
              >
                <option value={1}>{t('sa.metaAds.last30Days')}</option>
                <option value={3}>{t('sa.metaAds.last90Days')}</option>
                <option value={6}>{t('sa.metaAds.last6Months')}</option>
                <option value={12}>{t('sa.metaAds.lastYear')}</option>
              </select>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
                title={t('sa.metaAds.syncNow')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {t('sa.metaAds.sync')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sync Status Badge */}
      {config && config.last_sync_at && activeTab !== 'settings' && (
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg w-fit ${
          config.last_sync_status === 'success' ? 'bg-success/10 text-success' :
          config.last_sync_status === 'error' ? 'bg-error/10 text-error' :
          'bg-warning/10 text-warning'
        }`}>
          {config.last_sync_status === 'success' ? <CheckCircle className="w-3 h-3" /> :
           config.last_sync_status === 'error' ? <XCircle className="w-3 h-3" /> :
           <Loader2 className="w-3 h-3 animate-spin" />}
          {t('sa.metaAds.lastSync')}: {formatDate(config.last_sync_at)}
          {config.last_sync_error && <span className="ml-1">— {config.last_sync_error}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-glass-border overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-brand-accent text-brand-accent'
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
          {activeTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                <KpiCard icon={DollarSign} label={t('sa.metaAds.totalSpend')} value={fmtCurrency(overview.total_spend)} accent="bg-brand-accent/10 text-brand-accent" />
                <KpiCard icon={Eye} label={t('sa.metaAds.impressions')} value={fmtNumber(overview.total_impressions)} />
                <KpiCard icon={MousePointerClick} label={t('sa.metaAds.clicks')} value={fmtNumber(overview.total_clicks)} />
                <KpiCard icon={Activity} label={t('sa.metaAds.ctr')} value={fmtPct(overview.avg_ctr)} />
                <KpiCard icon={DollarSign} label={t('sa.metaAds.avgCPC')} value={fmtCurrency(overview.avg_cpc)} />
                <KpiCard icon={DollarSign} label={t('sa.metaAds.cpm')} value={fmtCurrency(overview.avg_cpm)} />
                <KpiCard icon={Target} label={t('sa.metaAds.conversions')} value={fmtNumber(overview.total_conversions)} accent="bg-success/10 text-success" />
                <KpiCard icon={Target} label={t('sa.metaAds.costPerConversion')} value={fmtCurrency(overview.avg_cost_per_conversion)} />
              </div>

              {/* Daily Spend Chart */}
              <div className="dashboard-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-accent" />
                    {t('sa.metaAds.dailySpend')}
                  </h3>
                  <span className="text-xs text-text-muted">{dailyData.length} {t('sa.metaAds.days')}</span>
                </div>
                <SpendChart data={dailyData} />
              </div>
            </div>
          )}

          {/* No overview data */}
          {activeTab === 'overview' && !overview && !isLoading && (
            <div className="dashboard-card p-8 text-center">
              <Megaphone className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('sa.metaAds.noData')}</h3>
              <p className="text-sm text-text-secondary mb-4">{t('sa.metaAds.noDataDescription')}</p>
              <button onClick={() => setActiveTab('settings')} className="btn btn-primary btn-sm">
                {t('sa.metaAds.configureNow')}
              </button>
            </div>
          )}

          {/* ─── CAMPAIGNS TAB ────────────────────────────── */}
          {activeTab === 'campaigns' && (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="text-left">{t('sa.metaAds.campaignName')}</th>
                    <th className="text-right">{t('sa.metaAds.spend')}</th>
                    <th className="text-right hidden md:table-cell">{t('sa.metaAds.impressions')}</th>
                    <th className="text-right hidden md:table-cell">{t('sa.metaAds.clicks')}</th>
                    <th className="text-right">{t('sa.metaAds.ctr')}</th>
                    <th className="text-right hidden md:table-cell">{t('sa.metaAds.avgCPC')}</th>
                    <th className="text-right">{t('sa.metaAds.conversions')}</th>
                    <th className="text-right">{t('sa.metaAds.costPerConversion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr><td colSpan={8} className="!text-center !font-body !text-text-secondary">{t('sa.metaAds.noCampaigns')}</td></tr>
                  ) : campaigns.map(c => (
                    <tr key={c.campaign_id}>
                      <td className="!font-body">
                        <div className="min-w-0">
                          <span className="font-medium text-text-primary truncate block">{c.campaign_name || t('sa.metaAds.unnamed')}</span>
                          <span className="text-[0.6rem] text-text-muted font-mono">{c.campaign_id}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold text-brand-accent text-sm">{fmtCurrency(c.total_spend)}</span>
                      </td>
                      <td className="text-right font-mono text-sm hidden md:table-cell">{fmtNumber(c.total_impressions)}</td>
                      <td className="text-right font-mono text-sm hidden md:table-cell">{fmtNumber(c.total_clicks)}</td>
                      <td className="text-right text-sm">{fmtPct(c.avg_ctr)}</td>
                      <td className="text-right font-mono text-sm text-text-secondary hidden md:table-cell">{fmtCurrency(c.avg_cpc)}</td>
                      <td className="text-right font-mono text-sm font-semibold text-success">{c.total_conversions}</td>
                      <td className="text-right font-mono text-sm">{c.total_conversions > 0 ? fmtCurrency(c.cost_per_conversion) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {campaigns.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-glass-border">
                      <td className="!font-body font-semibold text-text-primary">{t('sa.metaAds.total')}</td>
                      <td className="text-right font-mono font-bold text-brand-accent">{fmtCurrency(campaigns.reduce((s, c) => s + c.total_spend, 0))}</td>
                      <td className="text-right font-mono font-semibold text-text-primary hidden md:table-cell">{fmtNumber(campaigns.reduce((s, c) => s + c.total_impressions, 0))}</td>
                      <td className="text-right font-mono font-semibold text-text-primary hidden md:table-cell">{fmtNumber(campaigns.reduce((s, c) => s + c.total_clicks, 0))}</td>
                      <td />
                      <td className="hidden md:table-cell" />
                      <td className="text-right font-mono font-semibold text-success">{campaigns.reduce((s, c) => s + c.total_conversions, 0)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* ─── ROI ANALYSIS TAB ─────────────────────────── */}
          {activeTab === 'roi' && roiData && (
            <div className="space-y-6">
              {/* Main ROI KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                  icon={DollarSign}
                  label={t('sa.metaAds.totalAdSpend')}
                  value={fmtCurrency(roiData.total_ad_spend)}
                  accent="bg-brand-accent/10 text-brand-accent"
                />
                <KpiCard
                  icon={Target}
                  label={t('sa.metaAds.cac')}
                  value={roiData.cac > 0 ? fmtCurrency(roiData.cac) : '—'}
                  sub={t('sa.metaAds.cacDescription')}
                  accent="bg-warning/10 text-warning"
                />
                <KpiCard
                  icon={TrendingUp}
                  label={t('sa.metaAds.roas')}
                  value={roiData.roas > 0 ? `${roiData.roas.toFixed(2)}x` : '—'}
                  sub={t('sa.metaAds.roasDescription')}
                  trend={roiData.roas >= 1 ? 'up' : roiData.roas > 0 ? 'down' : 'neutral'}
                  accent={roiData.roas >= 1 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}
                />
                <KpiCard
                  icon={Zap}
                  label={t('sa.metaAds.roi')}
                  value={roiData.roi_pct !== 0 ? `${roiData.roi_pct.toFixed(1)}%` : '—'}
                  trend={roiData.roi_pct > 0 ? 'up' : roiData.roi_pct < 0 ? 'down' : 'neutral'}
                  accent={roiData.roi_pct > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}
                />
                <KpiCard
                  icon={CreditCard}
                  label={t('sa.metaAds.ltvCacRatio')}
                  value={roiData.ltv_cac_ratio > 0 ? `${roiData.ltv_cac_ratio.toFixed(1)}:1` : '—'}
                  sub={roiData.ltv_cac_ratio >= 3 ? '✓ Healthy' : roiData.ltv_cac_ratio > 0 ? '⚠ Below target (3:1)' : undefined}
                  trend={roiData.ltv_cac_ratio >= 3 ? 'up' : roiData.ltv_cac_ratio > 0 ? 'down' : 'neutral'}
                  accent={roiData.ltv_cac_ratio >= 3 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}
                />
                <KpiCard
                  icon={Calendar}
                  label={t('sa.metaAds.paybackPeriod')}
                  value={roiData.payback_months > 0 ? `${roiData.payback_months} mo` : '—'}
                  sub={t('sa.metaAds.paybackDescription')}
                />
              </div>

              {/* Revenue vs Spend Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ad Spend Summary */}
                <div className="dashboard-card p-5">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                    <Megaphone className="w-4 h-4 text-brand-accent" />
                    {t('sa.metaAds.spendSummary')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.totalAdSpend')}</span>
                      <span className="font-mono font-semibold text-brand-accent">{fmtCurrency(roiData.total_ad_spend)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.newSubscriptions')}</span>
                      <span className="font-mono font-semibold text-text-primary">{roiData.new_subscriptions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.newMRR')}</span>
                      <span className="font-mono font-semibold text-success">{fmtCurrency(roiData.new_mrr)}</span>
                    </div>
                    <div className="border-t border-glass-border pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-text-primary">{t('sa.metaAds.netReturn')}</span>
                      <span className={`font-mono font-bold ${(roiData.new_mrr - roiData.total_ad_spend) >= 0 ? 'text-success' : 'text-error'}`}>
                        {fmtCurrency(roiData.new_mrr - roiData.total_ad_spend)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subscription Overview */}
                <div className="dashboard-card p-5">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-brand-primary" />
                    {t('sa.metaAds.subscriptionOverview')}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.activeSubscriptions')}</span>
                      <span className="font-mono font-semibold text-text-primary">{roiData.active_sub_count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.totalActiveMRR')}</span>
                      <span className="font-mono font-semibold text-success">{fmtCurrency(roiData.total_active_mrr)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.avgRevenuePerSub')}</span>
                      <span className="font-mono font-semibold text-text-primary">{fmtCurrency(roiData.avg_revenue_per_sub)}</span>
                    </div>
                    <div className="border-t border-glass-border pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-text-primary">{t('sa.metaAds.estimatedLTV')}</span>
                      <span className="font-mono font-bold text-brand-primary">{fmtCurrency(roiData.ltv_estimate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LTV:CAC Health Indicator */}
              {roiData.ltv_cac_ratio > 0 && (
                <div className={`dashboard-card p-5 border ${
                  roiData.ltv_cac_ratio >= 3 ? 'border-success/30 bg-success/5' :
                  roiData.ltv_cac_ratio >= 1 ? 'border-warning/30 bg-warning/5' :
                  'border-error/30 bg-error/5'
                }`}>
                  <div className="flex items-start gap-3">
                    {roiData.ltv_cac_ratio >= 3 ? (
                      <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${roiData.ltv_cac_ratio >= 1 ? 'text-warning' : 'text-error'}`} />
                    )}
                    <div>
                      <h4 className={`text-sm font-semibold ${
                        roiData.ltv_cac_ratio >= 3 ? 'text-success' :
                        roiData.ltv_cac_ratio >= 1 ? 'text-warning' : 'text-error'
                      }`}>
                        {roiData.ltv_cac_ratio >= 3 ? t('sa.metaAds.healthyUnit') :
                         roiData.ltv_cac_ratio >= 1 ? t('sa.metaAds.cautionUnit') :
                         t('sa.metaAds.unhealthyUnit')}
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        {t('sa.metaAds.unitEconomicsExplanation', {
                          ltv: fmtCurrency(roiData.ltv_estimate),
                          cac: fmtCurrency(roiData.cac),
                          ratio: roiData.ltv_cac_ratio.toFixed(1),
                          payback: roiData.payback_months,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No ROI data */}
          {activeTab === 'roi' && !roiData && !isLoading && (
            <div className="dashboard-card p-8 text-center">
              <TrendingUp className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t('sa.metaAds.noData')}</h3>
              <p className="text-sm text-text-secondary">{t('sa.metaAds.noDataDescription')}</p>
            </div>
          )}

          {/* ─── SETTINGS TAB ─────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-2xl">
              {/* Current Config Status */}
              {config && (
                <div className="dashboard-card p-5">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-success" />
                    {t('sa.metaAds.currentConfig')}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('sa.metaAds.adAccountId')}</span>
                      <code className="text-brand-primary">act_{config.ad_account_id}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('sa.metaAds.apiVersion')}</span>
                      <span className="text-text-primary">{config.api_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{t('sa.metaAds.accessToken')}</span>
                      <span className="text-text-primary">{config.token_preview}</span>
                    </div>
                    {config.token_expires_at && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">{t('sa.metaAds.tokenExpires')}</span>
                        <span className={`${new Date(config.token_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'text-error' : 'text-text-primary'}`}>
                          {formatDate(config.token_expires_at)}
                        </span>
                      </div>
                    )}
                    {config.last_sync_at && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">{t('sa.metaAds.lastSync')}</span>
                        <div className="flex items-center gap-1.5">
                          {config.last_sync_status === 'success' ? (
                            <CheckCircle className="w-3 h-3 text-success" />
                          ) : config.last_sync_status === 'error' ? (
                            <XCircle className="w-3 h-3 text-error" />
                          ) : (
                            <Clock className="w-3 h-3 text-warning" />
                          )}
                          <span className="text-text-primary">{formatDate(config.last_sync_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Config Form */}
              <div className="dashboard-card p-5">
                <h3 className="text-sm font-semibold text-text-primary mb-4">
                  {config ? t('sa.metaAds.updateConfig') : t('sa.metaAds.setupConfig')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      {t('sa.metaAds.adAccountId')}
                    </label>
                    <input
                      type="text"
                      value={formAccountId}
                      onChange={e => setFormAccountId(e.target.value)}
                      placeholder="123456789"
                      className="input-field w-full"
                    />
                    <p className="text-[0.65rem] text-text-muted mt-1">{t('sa.metaAds.adAccountIdHelp')}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      {t('sa.metaAds.accessToken')}
                    </label>
                    <input
                      type="password"
                      value={formToken}
                      onChange={e => setFormToken(e.target.value)}
                      placeholder={config ? t('sa.metaAds.leaveBlankKeep') : t('sa.metaAds.pasteToken')}
                      className="input-field w-full"
                    />
                    <p className="text-[0.65rem] text-text-muted mt-1">{t('sa.metaAds.tokenHelp')}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">
                      {t('sa.metaAds.apiVersion')}
                    </label>
                    <select
                      value={formApiVersion}
                      onChange={e => setFormApiVersion(e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="v21.0">v21.0 (Latest)</option>
                      <option value="v20.0">v20.0</option>
                      <option value="v19.0">v19.0</option>
                    </select>
                  </div>

                  {/* Test/Save buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting || !formAccountId}
                      className="btn btn-secondary btn-sm flex items-center gap-1.5"
                    >
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      {t('sa.metaAds.testConnection')}
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSaving || !formAccountId || (!formToken && !config)}
                      className="btn btn-primary btn-sm flex items-center gap-1.5"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      {t('sa.metaAds.saveConfig')}
                    </button>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                      testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                      {testResult.success ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {t('sa.metaAds.connectionSuccess', { name: testResult.accountName })}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" />
                          {testResult.error}
                        </>
                      )}
                    </div>
                  )}

                  {/* Save Message */}
                  {saveMessage && (
                    <div className="text-sm text-brand-primary">{saveMessage}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
