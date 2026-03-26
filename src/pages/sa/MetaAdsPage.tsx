import { useState, useEffect, useCallback, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, DollarSign, TrendingUp, BarChart3, MousePointerClick,
  Eye, Target, Zap, RefreshCw, Settings, Activity, ArrowUpRight,
  ArrowDownRight, AlertTriangle, CheckCircle, XCircle, Loader2,
  Calendar, Clock, CreditCard, ChevronDown, ChevronUp, Link, Users
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
  objective: string | null;
  status: string | null;
}

interface AttributionLead {
  tenant_id: string;
  tenant_name: string;
  created_at: string;
  utm_source: string;
  utm_medium: string;
}

interface AttributionRow {
  campaign_name: string;
  objective: string | null;
  status: string | null;
  total_spend: number;
  meta_conversions: number;
  currency: string;
  platform_leads: number;
  leads_list: AttributionLead[];
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
  currency?: string;
}

type TabId = 'overview' | 'campaigns' | 'attribution' | 'roi' | 'settings';

// ─── Helpers ───────────────────────────────────────────────

function getLocaleForCurrency(currency: string): string {
  const map: Record<string, string> = {
    BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB',
    ARS: 'es-AR', MXN: 'es-MX', CLP: 'es-CL', COP: 'es-CO',
    JPY: 'ja-JP', CAD: 'en-CA', AUD: 'en-AU',
  };
  return map[currency.toUpperCase()] || 'en-US';
}

function fmtCurrency(v: number, currency = 'BRL'): string {
  const cur = currency.toUpperCase();
  const locale = getLocaleForCurrency(cur);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
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

// ─── Metric configs ────────────────────────────────────────

type MetricKey = 'spend' | 'clicks' | 'impressions' | 'conversions';

const METRIC_COLORS: Record<MetricKey, string> = {
  spend: '#fd79a8',
  clicks: '#6c5ce7',
  impressions: '#00cec9',
  conversions: '#fdcb6e',
};



// ─── Daily Performance Chart (SVG) ─────────────────────────

function DailyPerformanceChart({ data, currency, t }: {
  data: DailyRow[];
  currency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(new Set(['spend']));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return <div className="text-sm text-text-muted text-center py-8">{t('sa.metaAds.noData')}</div>;

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (key === 'spend') return next; // Spend always on
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const W = 800;
  const H = 220;
  const PAD = { top: 20, right: 60, bottom: 40, left: 70 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Compute scales
  const getMax = (key: MetricKey) => Math.max(...data.map(d => d[key]), 0.01);

  // Left axis = spend (currency), right axis = count metrics
  const maxSpend = getMax('spend');
  const countMetrics = (['clicks', 'impressions', 'conversions'] as MetricKey[]).filter(m => activeMetrics.has(m));
  const maxCount = countMetrics.length > 0
    ? Math.max(...countMetrics.map(m => getMax(m)))
    : 100;

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScaleSpend = (v: number) => PAD.top + chartH - (v / (maxSpend * 1.1)) * chartH;
  const yScaleCount = (v: number) => PAD.top + chartH - (v / (maxCount * 1.1)) * chartH;

  const buildPath = (key: MetricKey): string => {
    const yFn = key === 'spend' ? yScaleSpend : yScaleCount;
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yFn(d[key]).toFixed(1)}`).join(' ');
  };

  const buildAreaPath = (key: MetricKey): string => {
    const yFn = key === 'spend' ? yScaleSpend : yScaleCount;
    const linePart = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yFn(d[key]).toFixed(1)}`).join(' ');
    return `${linePart} L${xScale(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${xScale(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
  };

  // Smart date labels
  const labelInterval = data.length <= 10 ? 1 : data.length <= 20 ? 2 : Math.ceil(data.length / 10);

  // Y-axis ticks (left - spend)
  const spendTicks = Array.from({ length: 5 }, (_, i) => (maxSpend * 1.1 * i) / 4);
  // Y-axis ticks (right - count)
  const countTicks = countMetrics.length > 0 ? Array.from({ length: 5 }, (_, i) => (maxCount * 1.1 * i) / 4) : [];

  const metricButtons: { key: MetricKey; label: string }[] = [
    { key: 'spend', label: t('sa.metaAds.spend') },
    { key: 'clicks', label: t('sa.metaAds.clicks') },
    { key: 'impressions', label: t('sa.metaAds.impressions') },
    { key: 'conversions', label: t('sa.metaAds.conversions') },
  ];

  return (
    <div>
      {/* Metric Toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {metricButtons.map(m => {
          const isActive = activeMetrics.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                isActive
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-glass-border text-text-secondary hover:text-text-primary hover:border-glass-hover bg-transparent'
              }`}
              style={isActive ? { backgroundColor: METRIC_COLORS[m.key] + '99' } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: METRIC_COLORS[m.key] }} />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Defs for gradients */}
        <defs>
          {(Object.keys(METRIC_COLORS) as MetricKey[]).map(key => (
            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={METRIC_COLORS[key]} stopOpacity="0.25" />
              <stop offset="100%" stopColor={METRIC_COLORS[key]} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid */}
        {spendTicks.map((tick, i) => (
          <line key={`grid-${i}`} x1={PAD.left} x2={W - PAD.right} y1={yScaleSpend(tick)} y2={yScaleSpend(tick)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        ))}

        {/* Y-axis left (spend) */}
        {spendTicks.map((tick, i) => (
          <text key={`yL-${i}`} x={PAD.left - 6} y={yScaleSpend(tick) + 3}
            textAnchor="end" fill="#9898b0" fontSize="8" fontFamily="monospace">
            {tick >= 1000 ? `${(tick / 1000).toFixed(0)}K` : tick.toFixed(0)}
          </text>
        ))}

        {/* Y-axis right (count) */}
        {countTicks.map((tick, i) => (
          <text key={`yR-${i}`} x={W - PAD.right + 6} y={yScaleCount(tick) + 3}
            textAnchor="start" fill="#9898b0" fontSize="8" fontFamily="monospace">
            {tick >= 1000 ? `${(tick / 1000).toFixed(1)}K` : tick.toFixed(0)}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelInterval !== 0 && i !== data.length - 1) return null;
          return (
            <text key={`x-${i}`} x={xScale(i)} y={H - 8}
              textAnchor="middle" fill="#555570" fontSize="8" fontFamily="monospace">
              {d.day.substring(5)}
            </text>
          );
        })}

        {/* Area fills + lines */}
        {(Object.keys(METRIC_COLORS) as MetricKey[]).filter(k => activeMetrics.has(k)).map(key => (
          <g key={key}>
            <path d={buildAreaPath(key)} fill={`url(#grad-${key})`} opacity="0.8" />
            <path d={buildPath(key)} fill="none" stroke={METRIC_COLORS[key]}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 3px ${METRIC_COLORS[key]}40)` }} />
          </g>
        ))}

        {/* Data points on lines */}
        {(Object.keys(METRIC_COLORS) as MetricKey[]).filter(k => activeMetrics.has(k)).map(key => (
          data.map((d, i) => {
            const yFn = key === 'spend' ? yScaleSpend : yScaleCount;
            const isHovered = hoverIndex === i;
            return (
              <circle key={`dot-${key}-${i}`} cx={xScale(i)} cy={yFn(d[key])}
                r={isHovered ? 4 : 2} fill={METRIC_COLORS[key]} stroke="#0a0a0f" strokeWidth="1"
                opacity={isHovered ? 1 : 0.7}
                style={{ transition: 'r 0.15s ease, opacity 0.15s ease' }} />
            );
          })
        ))}

        {/* Hover zones */}
        {data.map((_, i) => {
          const colW = chartW / data.length;
          return (
            <rect key={`hz-${i}`}
              x={PAD.left + (i * colW)} y={PAD.top}
              width={colW} height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'crosshair' }}
            />
          );
        })}

        {/* Hover crosshair + tooltip */}
        {hoverIndex !== null && data[hoverIndex] && (
          <>
            <line x1={xScale(hoverIndex)} x2={xScale(hoverIndex)} y1={PAD.top} y2={PAD.top + chartH}
              stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3" />
            <foreignObject
              x={Math.min(xScale(hoverIndex) - 75, W - 180)}
              y={Math.max(PAD.top - 5, 0)}
              width="160" height="120">
              <div className="bg-bg-elevated/95 backdrop-blur-sm border border-glass-border rounded-lg px-3 py-2 text-[0.6rem] shadow-xl">
                <div className="text-text-secondary font-mono mb-1.5">{data[hoverIndex].day}</div>
                {activeMetrics.has('spend') && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: METRIC_COLORS.spend }}>● {t('sa.metaAds.spend')}</span>
                    <span className="text-text-primary font-mono">{fmtCurrency(data[hoverIndex].spend, currency)}</span>
                  </div>
                )}
                {activeMetrics.has('clicks') && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: METRIC_COLORS.clicks }}>● {t('sa.metaAds.clicks')}</span>
                    <span className="text-text-primary font-mono">{fmtNumber(data[hoverIndex].clicks)}</span>
                  </div>
                )}
                {activeMetrics.has('impressions') && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: METRIC_COLORS.impressions }}>● {t('sa.metaAds.impressions')}</span>
                    <span className="text-text-primary font-mono">{fmtNumber(data[hoverIndex].impressions)}</span>
                  </div>
                )}
                {activeMetrics.has('conversions') && (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: METRIC_COLORS.conversions }}>● {t('sa.metaAds.conversions')}</span>
                    <span className="text-text-primary font-mono">{data[hoverIndex].conversions}</span>
                  </div>
                )}
              </div>
            </foreignObject>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Efficiency Trends Chart ───────────────────────────────

function EfficiencyTrendsChart({ data, currency, t }: {
  data: DailyRow[];
  currency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  if (data.length < 2) return null;

  const computed = data.map(d => ({
    day: d.day,
    cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
    cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
  }));

  const metrics = [
    { key: 'cpc' as const, label: 'CPC', color: '#fd79a8', fmt: (v: number) => fmtCurrency(v, currency) },
    { key: 'cpm' as const, label: 'CPM', color: '#6c5ce7', fmt: (v: number) => fmtCurrency(v, currency) },
    { key: 'ctr' as const, label: 'CTR', color: '#00cec9', fmt: (v: number) => `${v.toFixed(2)}%` },
  ];

  const W = 260;
  const H = 80;
  const PAD = { top: 8, right: 8, bottom: 16, left: 8 };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {metrics.map(m => {
        const values = computed.map(c => c[m.key]);
        const maxV = Math.max(...values, 0.01);
        const minV = Math.min(...values);
        const range = maxV - minV || 1;
        const lastVal = values[values.length - 1] ?? 0;
        const prevVal = values.length >= 2 ? (values[values.length - 2] ?? lastVal) : lastVal;
        const trend = lastVal > prevVal ? 'up' : lastVal < prevVal ? 'down' : 'neutral';
        const avgVal = values.reduce((a, b) => a + b, 0) / values.length;

        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top - PAD.bottom;

        const path = computed.map((c, i) => {
          const x = PAD.left + (i / Math.max(computed.length - 1, 1)) * chartW;
          const y = PAD.top + chartH - ((c[m.key] - minV) / range) * chartH;
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');

        const areaPath = `${path} L${(PAD.left + chartW).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left},${(PAD.top + chartH).toFixed(1)} Z`;

        return (
          <div key={m.key} className="dashboard-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-xs font-medium text-text-secondary">{m.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-text-primary font-mono">{m.fmt(avgVal)}</span>
                {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-error" />}
                {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-success" />}
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
              <defs>
                <linearGradient id={`sparkGrad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={m.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#sparkGrad-${m.key})`} />
              <path d={path} fill="none" stroke={m.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between text-[0.55rem] text-text-muted mt-1 font-mono">
              <span>{computed[0]?.day.substring(5)}</span>
              <span>{t('sa.metaAds.efficiencyAvg')}</span>
              <span>{computed[computed.length - 1]?.day.substring(5)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Spend vs Conversions Chart ────────────────────────────

function SpendConversionsChart({ data, currency, t }: {
  data: DailyRow[];
  currency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  if (data.length === 0) return null;

  const hasConversions = data.some(d => d.conversions > 0);
  const maxSpend = Math.max(...data.map(d => d.spend), 0.01);
  const maxConv = Math.max(...data.map(d => d.conversions), 1);

  const W = 800;
  const H = 160;
  const PAD = { top: 16, right: 50, bottom: 32, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = Math.max((chartW / data.length) * 0.6, 4);
  const labelInterval = data.length <= 10 ? 1 : data.length <= 20 ? 2 : Math.ceil(data.length / 10);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Target className="w-4 h-4 text-warning" />
          {t('sa.metaAds.spendVsConversions')}
        </h3>
        <div className="flex items-center gap-3 text-[0.6rem] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#fd79a8' }} /> {t('sa.metaAds.spend')}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#fdcb6e' }} /> {t('sa.metaAds.conversions')}</span>
        </div>
      </div>

      {!hasConversions ? (
        <div className="text-xs text-text-muted text-center py-6">{t('sa.metaAds.noConversionsYet')}</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Bars (spend) */}
          {data.map((d, i) => {
            const x = PAD.left + (i / Math.max(data.length - 1, 1)) * chartW - barW / 2;
            const h = (d.spend / (maxSpend * 1.1)) * chartH;
            return (
              <rect key={`bar-${i}`} x={x} y={PAD.top + chartH - h} width={barW} height={h}
                rx="2" fill="#fd79a8" opacity="0.25" />
            );
          })}

          {/* Conversions line */}
          {(() => {
            const path = data.map((d, i) => {
              const x = PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
              const y = PAD.top + chartH - (d.conversions / (maxConv * 1.1)) * chartH;
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return <path d={path} fill="none" stroke="#fdcb6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
          })()}

          {/* Conversion dots */}
          {data.map((d, i) => {
            const x = PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = PAD.top + chartH - (d.conversions / (maxConv * 1.1)) * chartH;
            return d.conversions > 0 ? (
              <circle key={`conv-${i}`} cx={x} cy={y} r="3.5" fill="#fdcb6e" stroke="#0a0a0f" strokeWidth="1.5" />
            ) : null;
          })}

          {/* X-axis labels */}
          {data.map((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            return (
              <text key={`x-${i}`} x={PAD.left + (i / Math.max(data.length - 1, 1)) * chartW} y={H - 6}
                textAnchor="middle" fill="#555570" fontSize="8" fontFamily="monospace">
                {d.day.substring(5)}
              </text>
            );
          })}

          {/* Y-axis left (spend) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const val = maxSpend * 1.1 * pct;
            return (
              <text key={`yL-${i}`} x={PAD.left - 6} y={PAD.top + chartH - pct * chartH + 3}
                textAnchor="end" fill="#9898b0" fontSize="7" fontFamily="monospace">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0)}
              </text>
            );
          })}

          {/* Y-axis right (conversions) */}
          {[0, 0.5, 1].map((pct, i) => {
            const val = maxConv * 1.1 * pct;
            return (
              <text key={`yR-${i}`} x={W - PAD.right + 6} y={PAD.top + chartH - pct * chartH + 3}
                textAnchor="start" fill="#fdcb6e" fontSize="7" fontFamily="monospace">
                {Math.round(val)}
              </text>
            );
          })}
        </svg>
      )}
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
  const [attributionData, setAttributionData] = useState<AttributionRow[]>([]);
  const [roiData, setRoiData] = useState<ROIData | null>(null);
  const [adCurrency, setAdCurrency] = useState('BRL');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

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
        if (overviewRes.data?.currency) setAdCurrency(overviewRes.data.currency);
      } else if (tab === 'campaigns') {
        const res = await apiClient.get<CampaignRow[]>(`/admin-meta-ads?view=campaigns&months=${months}`);
        setCampaigns(res.data || []);
      } else if (tab === 'attribution') {
        const res = await apiClient.get<AttributionRow[]>(`/admin-meta-ads?view=attribution&months=${months}`);
        setAttributionData(res.data || []);
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
    { id: 'attribution', label: t('sa.metaAds.attribution'), icon: Users },
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
                <KpiCard icon={DollarSign} label={t('sa.metaAds.totalSpend')} value={fmtCurrency(overview.total_spend, adCurrency)} accent="bg-brand-accent/10 text-brand-accent" />
                <KpiCard icon={Eye} label={t('sa.metaAds.impressions')} value={fmtNumber(overview.total_impressions)} />
                <KpiCard icon={MousePointerClick} label={t('sa.metaAds.clicks')} value={fmtNumber(overview.total_clicks)} />
                <KpiCard icon={Activity} label={t('sa.metaAds.ctr')} value={fmtPct(overview.avg_ctr)} />
                <KpiCard icon={DollarSign} label={t('sa.metaAds.avgCPC')} value={fmtCurrency(overview.avg_cpc, adCurrency)} />
                <KpiCard icon={DollarSign} label={t('sa.metaAds.cpm')} value={fmtCurrency(overview.avg_cpm, adCurrency)} />
                <KpiCard icon={Target} label={t('sa.metaAds.conversions')} value={fmtNumber(overview.total_conversions)} accent="bg-success/10 text-success" />
                <KpiCard icon={Target} label={t('sa.metaAds.costPerConversion')} value={fmtCurrency(overview.avg_cost_per_conversion, adCurrency)} />
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
                    <th className="text-center">{t('sa.metaAds.status')}</th>
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
                    <tr><td colSpan={9} className="!text-center !font-body !text-text-secondary">{t('sa.metaAds.noCampaigns')}</td></tr>
                  ) : campaigns.map(c => (
                    <tr key={c.campaign_id}>
                      <td className="!font-body">
                        <div className="min-w-0">
                          <span className="font-medium text-text-primary truncate block">{c.campaign_name || t('sa.metaAds.unnamed')}</span>
                          <span className="text-[0.6rem] text-text-muted font-mono">{c.campaign_id}</span>
                          {c.objective && <span className="text-[0.65rem] bg-glass-element px-1.5 py-0.5 rounded text-text-secondary mt-1 inline-block">{c.objective}</span>}
                        </div>
                      </td>
                      <td className="text-center">
                        {c.status ? (
                          <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                            c.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-glass-element text-text-secondary'
                          }`}>
                            {c.status}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="text-right">
                        <span className="font-mono font-semibold text-brand-accent text-sm">{fmtCurrency(c.total_spend, adCurrency)}</span>
                      </td>
                      <td className="text-right font-mono text-sm hidden md:table-cell">{fmtNumber(c.total_impressions)}</td>
                      <td className="text-right font-mono text-sm hidden md:table-cell">{fmtNumber(c.total_clicks)}</td>
                      <td className="text-right text-sm">{fmtPct(c.avg_ctr)}</td>
                      <td className="text-right font-mono text-sm text-text-secondary hidden md:table-cell">{fmtCurrency(c.avg_cpc, adCurrency)}</td>
                      <td className="text-right font-mono text-sm font-semibold text-success">{c.total_conversions}</td>
                      <td className="text-right font-mono text-sm">{c.total_conversions > 0 ? fmtCurrency(c.cost_per_conversion, adCurrency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {campaigns.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-glass-border">
                      <td className="!font-body font-semibold text-text-primary">{t('sa.metaAds.total')}</td>
                      <td />
                      <td className="text-right font-mono font-bold text-brand-accent">{fmtCurrency(campaigns.reduce((s, c) => s + c.total_spend, 0), adCurrency)}</td>
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

          {/* ─── ATTRIBUTION TAB ──────────────────────────── */}
          {activeTab === 'attribution' && (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th className="text-left">{t('sa.metaAds.campaign')}</th>
                    <th className="text-center">{t('sa.metaAds.status')}</th>
                    <th className="text-right">{t('sa.metaAds.spend')}</th>
                    <th className="text-right">{t('sa.metaAds.platformLeads')}</th>
                    <th className="text-right hidden md:table-cell">{t('sa.metaAds.metaConversions')}</th>
                    <th className="text-right">{t('sa.metaAds.costPerLead')}</th>
                  </tr>
                </thead>
                <tbody>
                  {attributionData.length === 0 ? (
                    <tr><td colSpan={7} className="!text-center !font-body !text-text-secondary">{t('sa.metaAds.noAttributionData')}</td></tr>
                  ) : attributionData.map(row => {
                    const isExpanded = expandedCampaigns[row.campaign_name];
                    const cpl = row.platform_leads > 0 ? row.total_spend / row.platform_leads : 0;
                    return (
                      <Fragment key={row.campaign_name}>
                        <tr 
                          className={`cursor-pointer transition-colors ${isExpanded ? 'bg-brand-primary/5' : 'hover:bg-glass-element'} ${row.platform_leads === 0 ? 'opacity-60' : ''}`}
                          onClick={() => setExpandedCampaigns(prev => ({ ...prev, [row.campaign_name]: !prev[row.campaign_name] }))}
                        >
                          <td className="text-center">
                            {row.platform_leads > 0 ? (
                              isExpanded ? <ChevronUp className="w-4 h-4 text-text-secondary mx-auto" /> : <ChevronDown className="w-4 h-4 text-text-secondary mx-auto" />
                            ) : null}
                          </td>
                          <td className="!font-body">
                            <div className="min-w-0">
                              <span className="font-medium text-text-primary truncate block">{row.campaign_name}</span>
                              {row.objective && <span className="text-[0.65rem] bg-glass-element px-1.5 py-0.5 rounded text-text-secondary mt-1 inline-block">{row.objective}</span>}
                            </div>
                          </td>
                          <td className="text-center">
                            {row.status ? (
                              <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                                row.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-glass-element text-text-secondary'
                              }`}>
                                {row.status}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="text-right font-mono text-sm text-text-secondary">
                            {fmtCurrency(row.total_spend, adCurrency)}
                          </td>
                          <td className="text-right text-sm">
                            <span className="font-mono font-bold text-success">{row.platform_leads}</span>
                          </td>
                          <td className="text-right font-mono text-sm text-text-secondary hidden md:table-cell">
                            {row.meta_conversions}
                          </td>
                          <td className="text-right font-mono text-sm">
                            {row.platform_leads > 0 ? fmtCurrency(cpl, adCurrency) : '—'}
                          </td>
                        </tr>
                        {isExpanded && row.platform_leads > 0 && (
                          <tr className="bg-bg-primary/30 border-b border-glass-border">
                            <td colSpan={7} className="!p-0">
                              <div className="px-12 py-4 shadow-inner text-sm">
                                <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                                  <Users className="w-4 h-4 text-brand-primary" />
                                  {t('sa.metaAds.acquiredSubscriptions')}
                                </h4>
                                <div className="space-y-2">
                                  {row.leads_list.map(lead => (
                                    <div key={lead.tenant_id} className="flex items-center justify-between p-2 rounded border border-glass-border bg-glass-element hover:border-brand-primary/30 transition-colors">
                                      <div>
                                        <div className="font-medium text-text-primary">{lead.tenant_name}</div>
                                        <div className="text-[0.65rem] font-mono text-text-muted mt-0.5 flex gap-2">
                                          <span>{formatDate(lead.created_at)}</span>
                                          {lead.utm_source && <span className="text-brand-accent">src: {lead.utm_source}</span>}
                                          {lead.utm_medium && <span className="text-brand-primary">med: {lead.utm_medium}</span>}
                                        </div>
                                      </div>
                                      <a href={`/sa/users/${lead.tenant_id}`} className="p-1 text-text-secondary hover:text-brand-primary transition-colors" target="_blank" rel="noreferrer">
                                        <Link className="w-4 h-4" />
                                      </a>
                                    </div>
                                  ))}
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

          {/* ─── ROI ANALYSIS TAB ─────────────────────────── */}
          {activeTab === 'roi' && roiData && (
            <div className="space-y-6">
              {/* Main ROI KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                  icon={DollarSign}
                  label={t('sa.metaAds.totalAdSpend')}
                  value={fmtCurrency(roiData.total_ad_spend, adCurrency)}
                  accent="bg-brand-accent/10 text-brand-accent"
                />
                <KpiCard
                  icon={Target}
                  label={t('sa.metaAds.cac')}
                  value={roiData.cac > 0 ? fmtCurrency(roiData.cac, adCurrency) : '—'}
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
                      <span className="font-mono font-semibold text-brand-accent">{fmtCurrency(roiData.total_ad_spend, adCurrency)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.newSubscriptions')}</span>
                      <span className="font-mono font-semibold text-text-primary">{roiData.new_subscriptions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.newMRR')}</span>
                      <span className="font-mono font-semibold text-success">{fmtCurrency(roiData.new_mrr, adCurrency)}</span>
                    </div>
                    <div className="border-t border-glass-border pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-text-primary">{t('sa.metaAds.netReturn')}</span>
                      <span className={`font-mono font-bold ${(roiData.new_mrr - roiData.total_ad_spend) >= 0 ? 'text-success' : 'text-error'}`}>
                        {fmtCurrency(roiData.new_mrr - roiData.total_ad_spend, adCurrency)}
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
                      <span className="font-mono font-semibold text-success">{fmtCurrency(roiData.total_active_mrr, adCurrency)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">{t('sa.metaAds.avgRevenuePerSub')}</span>
                      <span className="font-mono font-semibold text-text-primary">{fmtCurrency(roiData.avg_revenue_per_sub, adCurrency)}</span>
                    </div>
                    <div className="border-t border-glass-border pt-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-text-primary">{t('sa.metaAds.estimatedLTV')}</span>
                      <span className="font-mono font-bold text-brand-primary">{fmtCurrency(roiData.ltv_estimate, adCurrency)}</span>
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
                          ltv: fmtCurrency(roiData.ltv_estimate, adCurrency),
                          cac: fmtCurrency(roiData.cac, adCurrency),
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
