import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Globe,
  TrendingUp,
  Building2,
  Target,
  Award,
  Eye,
  Search,
  PieChart,
  Radar,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { apiClient } from '@/lib/api';
import { ScoreRing } from '@/components/geo';
import { PageExplanation } from '@/components/PageExplanation';

// ─── Types ──────────────────────────────────────────────────

interface ScoreBreakdown {
  mention_rate: number;
  platform_breadth: number;
  prompt_coverage: number;
  distribution: number;
}

interface PlatformMention {
  platform_slug: string;
  platform_name: string;
  count: number;
  percent: number;
}

interface PromptMention {
  prompt_id: string;
  prompt_text: string;
  count: number;
}

interface SourceItem {
  domain: string;
  total: number;
  percent: number;
  score: number;
  score_breakdown: ScoreBreakdown;
  total_by_platform: PlatformMention[];
  total_by_prompt: PromptMention[];
}

interface OwnDomainData extends SourceItem {
  rank: number;
  total_sources: number;
  platforms_mentioning: number;
  platforms_total: number;
}

interface TimelineItem {
  date: string;
  count: number;
}

interface GeoData {
  composite_score: number;
  readiness_level: number;
  category_scores: {
    technical: number;
    content: number;
    authority: number;
    semantic: number;
  } | null;
  pages_crawled: number;
}

interface ScoreDistItem {
  range: string;
  count: number;
}

interface HeatmapSource {
  domain: string;
  platforms: Record<string, number>;
}

interface AnalyticsData {
  overview: {
    total_prompts: number;
    active_prompts: number;
    total_answers: number;
    total_sources: number;
    total_citations: number;
    unique_platforms: number;
  };
  own_domain: OwnDomainData | null;
  top_competitors: SourceItem[];
  answers_timeline: TimelineItem[];
  geo: GeoData | null;
  source_score_distribution: ScoreDistItem[];
  own_domain_score_range: string | null;
  heatmap: {
    sources: HeatmapSource[];
    platforms: Array<{ platform_slug: string; platform_name: string }>;
  };
}

// ─── Theme colors ───────────────────────────────────────────

const COLORS = [
  '#6c5ce7', '#e84393', '#00cec9', '#a29bfe',
  '#74b9ff', '#fdcb6e', '#fab1a0', '#55efc4',
];
const OWN_COLOR = '#00cec9';
const BRAND = '#6c5ce7';
const NEUTRAL = '#3b3b5c';

// ─── Main ───────────────────────────────────────────────────

export function AnalysesPage() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.get<AnalyticsData>('analyses-data');
      setData(res.data);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="stagger-enter space-y-6">
        <h1 className="text-xl font-bold text-text-primary">{t('nav.analyses')}</h1>
        <div className="p-4 rounded-xs bg-error/10 border border-error/20 text-error text-sm">{error}</div>
      </div>
    );
  }

  if (!data || (data.overview.total_answers === 0 && !data.own_domain)) {
    return (
      <div className="stagger-enter space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('nav.analyses')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('analyses.subtitle')}</p>
        </div>
        <div className="dashboard-card p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-brand-primary" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">{t('analyses.emptyTitle')}</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">{t('analyses.emptyDesc')}</p>
        </div>
      </div>
    );
  }

  const own = data.own_domain;

  return (
    <div className="stagger-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('nav.analyses')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('analyses.subtitle')}</p>
        </div>
        <PageExplanation message={t('analyses.banner')} />
      </div>

      {/* ── Row 1: KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={<Award className="w-4 h-4" />} color={BRAND}
          label={t('analyses.kpiVisibility')} value={own ? `${own.score}` : '—'}
          sub={own ? t('analyses.kpiOutOf100') : t('analyses.kpiNoDomain')} />
        <KPI icon={<Eye className="w-4 h-4" />} color={OWN_COLOR}
          label={t('analyses.kpiMentionRate')} value={own ? `${own.percent}%` : '—'}
          sub={own ? t('analyses.kpiOfAllCitations') : t('analyses.kpiNoDomain')} />
        <KPI icon={<Globe className="w-4 h-4" />} color="#e84393"
          label={t('analyses.kpiPlatformCoverage')}
          value={own ? `${own.platforms_mentioning}/${own.platforms_total}` : '—'}
          sub={t('analyses.kpiPlatformsMention')} />
        <KPI icon={<Target className="w-4 h-4" />} color="#a29bfe"
          label={t('analyses.kpiSourceRank')} value={own ? `#${own.rank}` : '—'}
          sub={own ? t('analyses.kpiOfSources', { count: own.total_sources }) : t('analyses.kpiNoDomain')} />
      </div>

      {/* ── Row 2: Citation Share + GEO ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CitationSharePie own={own} totalCitations={data.overview.total_citations} competitors={data.top_competitors} t={t} />
        {data.geo && <GeoRadarCard geo={data.geo} t={t} />}
      </div>

      {/* ── Row 3: Score Radar (full width) ───────────────────── */}
      {own && <ScoreRadar breakdown={own.score_breakdown} overallScore={own.score} t={t} />}

      {/* ── Row 4: Platform Mentions + Prompt Coverage ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {own && own.total_by_platform.length > 0 && (
          <PlatformMentionBars platforms={own.total_by_platform} t={t} />
        )}
        {own && own.total_by_prompt.length > 0 && (
          <div className="lg:col-span-2">
            <PromptCoverage prompts={own.total_by_prompt} t={t} />
          </div>
        )}
      </div>

      <CompetitorMatrix
        own={own}
        competitors={data.top_competitors}
        heatmap={data.heatmap}
        tenantDomain={currentTenant?.main_domain?.toLowerCase() || ''}
        t={t}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  COMPONENTS
// ═════════════════════════════════════════════════════════════

/* ── Skeleton ────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-7 w-72" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="dashboard-card p-5"><div className="skeleton h-20 w-full" /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-card p-6"><div className="skeleton h-64 w-full" /></div>
        <div className="dashboard-card p-6"><div className="skeleton h-64 w-full" /></div>
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────────── */

function KPI({ icon, color, label, value, sub }: {
  icon: React.ReactNode; color: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="dashboard-card p-4 sm:p-5 hover:shadow-lg transition-shadow group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, color }}>
          {icon}
        </div>
        <span className="kpi-label text-[10px] sm:text-xs truncate">{label}</span>
      </div>
      <p className="kpi-value text-xl sm:text-2xl">{value}</p>
      <p className="text-[10px] sm:text-xs text-text-muted mt-1 truncate">{sub}</p>
    </div>
  );
}

/* ── Citation Share Pie Chart ────────────────────────────── */

function CitationSharePie({ own, totalCitations, competitors, t }: {
  own: OwnDomainData | null; totalCitations: number;
  competitors: SourceItem[];
  t: ReturnType<typeof useTranslation>['t'];
}) {

  const segments = useMemo(() => {
    const SEGMENT_COLORS = [OWN_COLOR, '#6c5ce7', '#e84393', '#a29bfe', NEUTRAL];
    const ownTotal = own?.total || 0;
    const top3 = [...competitors].sort((a, b) => b.total - a.total).slice(0, 3);
    const top3Total = top3.reduce((sum, c) => sum + c.total, 0);
    const othersTotal = Math.max(0, totalCitations - ownTotal - top3Total);

    const items: Array<{ label: string; count: number; pct: number; color: string; isOwn?: boolean }> = [];

    items.push({
      label: t('analyses.yourDomain'),
      count: ownTotal,
      pct: totalCitations > 0 ? Math.round((ownTotal / totalCitations) * 1000) / 10 : 0,
      color: SEGMENT_COLORS[0]!,
      isOwn: true,
    });

    top3.forEach((c, i) => {
      items.push({
        label: c.domain,
        count: c.total,
        pct: totalCitations > 0 ? Math.round((c.total / totalCitations) * 1000) / 10 : 0,
        color: SEGMENT_COLORS[i + 1]!,
      });
    });

    if (othersTotal > 0 || top3.length < competitors.length) {
      items.push({
        label: t('analyses.otherSources'),
        count: othersTotal,
        pct: totalCitations > 0 ? Math.round((othersTotal / totalCitations) * 1000) / 10 : 0,
        color: SEGMENT_COLORS[4]!,
      });
    }

    return items;
  }, [own, competitors, totalCitations, t]);

  const ownPct = segments[0]?.pct || 0;

  // SVG donut parameters
  const size = 180;
  const sw = 28;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  // Build arc segments
  let cumulativeOffset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * circ;
    const offset = cumulativeOffset;
    cumulativeOffset += dash;
    return { ...seg, dash, rotationDeg: -90 + (offset / circ) * 360 };
  });

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <PieChart className="w-4 h-4 text-brand-secondary" />
          {t('analyses.citationShareTitle')}
        </h2>
        <span className="text-xs text-text-muted">{totalCitations} {t('analyses.totalCitations')}</span>
      </div>
      <div className="flex items-center justify-center gap-8 mt-2">
        <div className="relative shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background ring */}
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="var(--color-bg-tertiary)" strokeWidth={sw} />
            {/* Segments (draw in reverse so first segment is on top) */}
            {[...arcs].reverse().map((arc, i) => (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={arc.color} strokeWidth={sw}
                strokeOpacity={arc.isOwn ? 1 : 0.7}
                strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
                transform={`rotate(${arc.rotationDeg} ${size / 2} ${size / 2})`}
                strokeLinecap={arc.isOwn ? 'round' : undefined}
                style={{ transition: 'all 1s ease' }} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold font-mono" style={{ color: OWN_COLOR }}>{ownPct}%</span>
            <span className="text-[10px] text-text-muted">{t('analyses.yourShare')}</span>
          </div>
        </div>
        <div className="space-y-2.5 min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: seg.color, opacity: seg.isOwn ? 1 : 0.7 }} />
                <span className={`text-xs truncate max-w-[140px] ${seg.isOwn ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{seg.label}</span>
              </div>
              <div className="pl-5 text-[10px] text-text-muted">{seg.count} {t('analyses.mentions')} · {seg.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Score Radar / Spider Chart ──────────────────────────── */

function ScoreRadar({ breakdown, overallScore, t }: {
  breakdown: ScoreBreakdown; overallScore: number;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const axes = [
    { key: 'mention_rate', label: t('analyses.radarMention'), value: breakdown.mention_rate },
    { key: 'platform_breadth', label: t('analyses.radarPlatform'), value: breakdown.platform_breadth },
    { key: 'prompt_coverage', label: t('analyses.radarPrompt'), value: breakdown.prompt_coverage },
    { key: 'distribution', label: t('analyses.radarDistribution'), value: breakdown.distribution },
  ];

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 75;
  const levels = 4;

  // Generate polygon points for a set of values (0-100 scale)
  function polyPoints(values: number[]) {
    return values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const radius = (v / 100) * maxR;
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
    }).join(' ');
  }

  // Label positions
  function labelPos(i: number, offset: number = 14) {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return {
      x: cx + (maxR + offset) * Math.cos(angle),
      y: cy + (maxR + offset) * Math.sin(angle),
    };
  }

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Radar className="w-4 h-4 text-brand-secondary" />
          {t('analyses.radarTitle')}
        </h2>
        <span className="text-sm font-mono font-bold" style={{ color: BRAND }}>{overallScore}</span>
      </div>
      <div className="flex justify-center mt-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid levels */}
          {[...Array(levels)].map((_, l) => {
            const vals = axes.map(() => ((l + 1) / levels) * 100);
            return (
              <polygon key={l} points={polyPoints(vals)}
                fill="none" stroke="var(--color-glass-border)" strokeWidth={1}
                opacity={0.5} />
            );
          })}
          {/* Axis lines */}
          {axes.map((_, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
            return (
              <line key={i} x1={cx} y1={cy}
                x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
                stroke="var(--color-glass-border)" strokeWidth={1} opacity={0.3} />
            );
          })}
          {/* Data polygon */}
          <polygon
            points={polyPoints(axes.map(a => a.value))}
            fill={`${BRAND}22`} stroke={BRAND} strokeWidth={2}
            style={{ transition: 'all 0.8s ease' }} />
          {/* Data dots */}
          {axes.map((a, i) => {
            const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
            const radius = (a.value / 100) * maxR;
            return (
              <circle key={i}
                cx={cx + radius * Math.cos(angle)} cy={cy + radius * Math.sin(angle)}
                r={4} fill={BRAND} stroke="#fff" strokeWidth={1.5}
                style={{ transition: 'all 0.8s ease' }} />
            );
          })}
          {/* Labels */}
          {axes.map((a, i) => {
            const pos = labelPos(i, 18);
            return (
              <text key={i} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                fill="var(--color-text-secondary)" fontSize={10} fontWeight={500}>
                {a.label}
              </text>
            );
          })}
          {/* Value labels */}
          {axes.map((a, i) => {
            const pos = labelPos(i, 30);
            return (
              <text key={`v${i}`} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                fill="var(--color-text-muted)" fontSize={9}
                fontFamily="var(--font-mono)">
                {Math.round(a.value)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ── Platform Mention Bars (Horizontal) ──────────────────── */

function PlatformMentionBars({ platforms, t }: {
  platforms: PlatformMention[];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const maxCount = Math.max(1, ...platforms.map(p => p.count));

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Globe className="w-4 h-4 text-brand-secondary" />
          {t('analyses.platformMentionsTitle')}
        </h2>
        <span className="text-xs text-text-muted">
          {platforms.length} {t('analyses.platformsActive')}
        </span>
      </div>
      <div className="space-y-3">
        {platforms.map((p, i) => {
          const pct = Math.round((p.count / maxCount) * 100);
          const color = COLORS[i % COLORS.length]!;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-text-primary font-medium">{p.platform_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-primary">{p.count}</span>
                  <span className="text-[10px] text-text-muted">({p.percent}%)</span>
                </div>
              </div>
              <div className="w-full h-2.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Competitor Matrix (unified: score circle + heatmap) ────── */

function CompetitorMatrix({ own, competitors, heatmap, tenantDomain, t }: {
  own: OwnDomainData | null;
  competitors: SourceItem[];
  heatmap: AnalyticsData['heatmap'];
  tenantDomain: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  // Merge competitor scores with heatmap platform data
  const rows = useMemo(() => {
    const list: Array<SourceItem & { isOwn: boolean }> = [];
    if (own) list.push({ ...own, isOwn: true });
    competitors.forEach(c => list.push({ ...c, isOwn: false }));
    list.sort((a, b) => b.score - a.score);

    // Build a map of domain → platform counts from heatmap
    const platformMap = new Map<string, Record<string, number>>();
    for (const s of heatmap.sources) {
      platformMap.set(s.domain.toLowerCase(), s.platforms);
    }

    return list.slice(0, 10).map((source, i) => ({
      ...source,
      rank: i + 1,
      platformCounts: platformMap.get(source.domain.toLowerCase()) || {},
    }));
  }, [own, competitors, heatmap]);

  const platforms = heatmap.platforms;
  const maxVal = Math.max(
    1,
    ...rows.flatMap(r => Object.values(r.platformCounts)),
  );

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <TrendingUp className="w-4 h-4 text-brand-secondary" />
          {t('analyses.competitorTitle')}
        </h2>
        <span className="text-xs text-text-muted">
          {t('analyses.competitorSub', { count: rows.length })}
        </span>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="text-left">{t('analyses.heatmapSource')}</th>
              <th className="text-center w-16">{t('analyses.matrixScore')}</th>
              {platforms.map(p => (
                <th key={p.platform_slug} className="text-center">{p.platform_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isOwn = row.isOwn || (tenantDomain && row.domain.toLowerCase() === tenantDomain);
              return (
                <tr key={row.domain}>
                  {/* Rank */}
                  <td className="text-text-muted text-center">{row.rank}</td>
                  {/* Domain */}
                  <td className={isOwn ? 'font-semibold' : ''}
                    style={isOwn ? { color: OWN_COLOR } : undefined}>
                    {row.domain}
                    {isOwn && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: `${OWN_COLOR}22`, color: OWN_COLOR }}>
                        {t('analyses.you')}
                      </span>
                    )}
                  </td>
                  {/* Score circle */}
                  <td className="text-center">
                    <MiniScoreCircle score={row.score} isOwn={!!isOwn} />
                  </td>
                  {/* Platform heatmap cells */}
                  {platforms.map(p => {
                    const val = row.platformCounts[p.platform_slug] || 0;
                    const intensity = val / maxVal;
                    return (
                      <td key={p.platform_slug} className="text-center">
                        {val > 0 ? (
                          <span className="inline-block min-w-[28px] px-1.5 py-0.5 rounded text-xs font-mono"
                            style={{
                              background: isOwn
                                ? `rgba(0, 206, 201, ${0.1 + intensity * 0.5})`
                                : `rgba(108, 92, 231, ${0.08 + intensity * 0.5})`,
                              color: intensity > 0.6 ? '#fff' : 'var(--color-text-primary)',
                            }}>
                            {val}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Mini Score Circle (inline SVG) ──────────────────────── */

function MiniScoreCircle({ score, isOwn }: { score: number; isOwn: boolean }) {
  const size = 32;
  const sw = 2.5;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score, 100) / 100;
  const dash = pct * circ;
  const color = isOwn ? OWN_COLOR : BRAND;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ verticalAlign: 'middle', display: 'inline-block' }}
      aria-label={`Score: ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--color-bg-tertiary)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontFamily="var(--font-mono)" fontWeight={700}
        fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

/* ── Prompt Coverage (Horizontal Bar Chart) ──────────────── */

function PromptCoverage({ prompts, t }: {
  prompts: PromptMention[];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const sorted = useMemo(() =>
    [...prompts].sort((a, b) => b.count - a.count).slice(0, 8),
    [prompts]);
  const maxCount = Math.max(1, ...sorted.map(p => p.count));

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Search className="w-4 h-4 text-brand-secondary" />
          {t('analyses.promptCoverageTitle')}
        </h2>
        <span className="text-xs text-text-muted">
          {t('analyses.promptCoverageSub', { count: sorted.length })}
        </span>
      </div>
      <div className="space-y-2.5">
        {sorted.map((prompt, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary truncate max-w-[70%]">
                {prompt.prompt_text || prompt.prompt_id}
              </span>
              <span className="text-xs font-mono text-text-primary shrink-0">{prompt.count}×</span>
            </div>
            <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${(prompt.count / maxCount) * 100}%`,
                  background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[i % COLORS.length]}88)`,
                }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



/* ── GEO Radar Card ──────────────────────────────────────── */

function GeoRadarCard({ geo, t }: {
  geo: GeoData;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const categories = geo.category_scores;

  if (!categories) {
    return (
      <div className="dashboard-card p-6">
        <div className="card-header">
          <h2 className="card-title">
            <Building2 className="w-4 h-4 text-brand-secondary" />
            {t('analyses.geoTitle')}
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <ScoreRing score={geo.composite_score} size={100} />
          <div className="text-sm text-text-secondary">
            {t('analyses.geoLevel', { level: geo.readiness_level })}
          </div>
        </div>
      </div>
    );
  }

  const axes = [
    { label: t('analyses.geoTechnical'), value: categories.technical },
    { label: t('analyses.geoContent'), value: categories.content },
    { label: t('analyses.geoAuthority'), value: categories.authority },
    { label: t('analyses.geoSemantic'), value: categories.semantic },
  ];

  const size = 160;
  const cx = size / 2, cy = size / 2, maxR = 60;

  function poly(values: number[]) {
    return values.map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const radius = (v / 100) * maxR;
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
    }).join(' ');
  }

  const geoColor = '#e84393';

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Building2 className="w-4 h-4 text-brand-secondary" />
          {t('analyses.geoTitle')}
        </h2>
        <span className="text-xs text-text-muted">{t('analyses.geoLevel', { level: geo.readiness_level })}</span>
      </div>
      <div className="flex items-center gap-6">
        {/* GEO Score Ring */}
        <ScoreRing score={geo.composite_score} size={90} />

        {/* Mini radar for categories */}
        <div className="shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {[1, 2, 3, 4].map(l => (
              <polygon key={l}
                points={poly(axes.map(() => (l / 4) * 100))}
                fill="none" stroke="var(--color-glass-border)" strokeWidth={0.5} opacity={0.5} />
            ))}
            {axes.map((_, i) => {
              const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
              return (
                <line key={i} x1={cx} y1={cy}
                  x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
                  stroke="var(--color-glass-border)" strokeWidth={0.5} opacity={0.3} />
              );
            })}
            <polygon points={poly(axes.map(a => a.value))}
              fill={`${geoColor}22`} stroke={geoColor} strokeWidth={2}
              style={{ transition: 'all 0.8s ease' }} />
            {axes.map((a, i) => {
              const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
              const r = (a.value / 100) * maxR;
              return (
                <circle key={i} cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)}
                  r={3} fill={geoColor} stroke="#fff" strokeWidth={1} />
              );
            })}
            {axes.map((a, i) => {
              const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
              const lx = cx + (maxR + 14) * Math.cos(angle);
              const ly = cy + (maxR + 14) * Math.sin(angle);
              return (
                <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill="var(--color-text-muted)">{a.label}</text>
              );
            })}
          </svg>
        </div>

        {/* Category scores list */}
        <div className="flex-1 space-y-2 min-w-0">
          {axes.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-16 truncate">{a.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${a.value}%`, background: `linear-gradient(90deg, ${geoColor}, ${geoColor}88)` }} />
              </div>
              <span className="text-xs font-mono text-text-primary w-7 text-right">{Math.round(a.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-text-muted mt-3">{t('analyses.geoPages', { count: geo.pages_crawled })}</p>
    </div>
  );
}



/* ── Heatmap Table ───────────────────────────────────────── */

/* HeatmapTable removed — merged into CompetitorMatrix above */
