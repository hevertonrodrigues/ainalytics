import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Lightbulb,
  ShieldCheck,
  Eye,
  FileText,
  Wrench,
  Activity,
  Swords,
  Zap,
  Info,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { ScoreRing } from '@/components/geo';
import { PageExplanation } from '@/components/PageExplanation';
import type { InsightsData, InsightsCheck, InsightsActionItem, InsightsHighlight } from '@/types';

// ─── Overlay phrases ────────────────────────────────────────
const OVERLAY_PHASES = [
  'insightsPage.overlay.analyzing',
  'insightsPage.overlay.aggregating',
  'insightsPage.overlay.scoring',
  'insightsPage.overlay.generating',
  'insightsPage.overlay.finalizing',
];

// ─── Category icons & colors ────────────────────────────────
const CATEGORY_CONFIG: Record<string, { icon: typeof Eye; color: string; i18nKey: string }> = {
  visibility:   { icon: Eye,      color: '#6c5ce7', i18nKey: 'categoryVisibility' },
  content:      { icon: FileText, color: '#fd79a8', i18nKey: 'categoryContent' },
  technical:    { icon: Wrench,   color: '#00cec9', i18nKey: 'categoryTechnical' },
  monitoring:   { icon: Activity, color: '#fdcb6e', i18nKey: 'categoryMonitoring' },
  competitive:  { icon: Swords,   color: '#a29bfe', i18nKey: 'categoryCompetitive' },
};

// ─── Status badge colors ────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  pass:    { bg: 'rgba(0,206,201,0.08)',  text: '#00cec9', border: 'rgba(0,206,201,0.25)' },
  warning: { bg: 'rgba(253,203,110,0.08)', text: '#e67c00', border: 'rgba(253,203,110,0.25)' },
  fail:    { bg: 'rgba(220,53,69,0.08)',   text: '#dc3545', border: 'rgba(220,53,69,0.25)' },
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
};

// ─── Health badge styles ────────────────────────────────────
const HEALTH_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  good:     { bg: 'rgba(0,206,201,0.10)', text: '#00cec9', border: 'rgba(0,206,201,0.30)', glow: '0 0 12px rgba(0,206,201,0.20)' },
  warning:  { bg: 'rgba(230,124,0,0.10)', text: '#e67c00', border: 'rgba(230,124,0,0.30)', glow: '0 0 12px rgba(230,124,0,0.20)' },
  critical: { bg: 'rgba(220,53,69,0.10)', text: '#dc3545', border: 'rgba(220,53,69,0.30)', glow: '0 0 12px rgba(220,53,69,0.20)' },
};

// ─── Impact/Effort badge colors ─────────────────────────────
const IMPACT_COLORS: Record<string, string> = {
  high: '#dc3545',
  medium: '#e67c00',
  low: '#00cec9',
};

// ─── GET response type ──────────────────────────────────────
interface InsightsGetResponse {
  insights: InsightsData | null;
  is_stale: boolean;
  next_refresh_at: string | null;
}

// ─── Main Component ─────────────────────────────────────────
export function InsightsPage() {
  const { t, i18n } = useTranslation();

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayPhase, setOverlayPhase] = useState(0);
  const overlayInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationTriggered = useRef(false);

  // ─── Generate insights ────────────────────────────────────
  const generateInsights = useCallback(async () => {
    if (generating || generationTriggered.current) return;
    generationTriggered.current = true;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiClient.post<InsightsData>('/insights', {
        language: i18n.language,
      });
      setInsights(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setGenerating(false);
    }
  }, [generating, i18n.language, t]);

  // ─── Fetch cached insights on mount ──────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await apiClient.get<InsightsGetResponse>('/insights');
        if (cancelled) return;

        const { insights: cached, is_stale } = res.data;

        if (cached && !is_stale) {
          // Fresh insights — just display them
          setInsights(cached);
          setLoading(false);
        } else {
          // No insights or stale — auto-generate
          setLoading(false);
          generateInsights();
        }
      } catch {
        if (cancelled) return;
        setLoading(false);
        // Failed to fetch — auto-generate anyway
        generateInsights();
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Overlay phase rotation ──────────────────────────────
  useEffect(() => {
    if (generating) {
      setOverlayPhase(0);
      overlayInterval.current = setInterval(() => {
        setOverlayPhase((p) => (p + 1) % OVERLAY_PHASES.length);
      }, 8000);
    } else {
      if (overlayInterval.current) clearInterval(overlayInterval.current);
    }
    return () => {
      if (overlayInterval.current) clearInterval(overlayInterval.current);
    };
  }, [generating]);

  // ─── Loading skeleton ─────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="h-8 w-48 rounded-lg skeleton" />
        <div className="h-4 w-80 rounded skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-card p-6 h-40 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Format date ──────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 stagger-in">
      {/* ─── Generating Overlay ─────────────────────────────── */}
      {generating && <GeneratingOverlay phase={overlayPhase} t={t} />}

      {/* ─── Page Header ────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
          <Sparkles className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
          {t('insightsPage.title')}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{t('insightsPage.subtitle')}</p>
      </div>

      <PageExplanation message={t('tutorials.insights.p1')} />

      {/* ─── Error banner ───────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ─── Empty State (only while generating) ────────────── */}
      {!insights && !error && !generating && (
        <div className="dashboard-card p-12 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(108,92,231,0.10)', border: '1px solid rgba(108,92,231,0.20)' }}
          >
            <Sparkles className="w-8 h-8" style={{ color: 'var(--brand-primary)' }} />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {t('insightsPage.emptyTitle')}
          </h3>
          <p className="text-sm text-text-secondary max-w-md">
            {t('insightsPage.emptyDesc')}
          </p>
        </div>
      )}

      {/* ─── Insights Content ───────────────────────────────── */}
      {insights && (
        <>
          {/* Health Score + Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Health Score Card */}
            <HealthScoreCard insights={insights} t={t} />

            {/* Summary Card */}
            <div className="dashboard-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                <h3 className="text-sm font-semibold text-text-primary">{t('insightsPage.summaryTitle')}</h3>
              </div>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {insights.summary}
              </div>
              {insights.created_at && (
                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                  <Clock className="w-3 h-3 text-text-muted" />
                  <span className="text-[11px] text-text-muted">
                    {t('insightsPage.lastGenerated')}: {formatDate(insights.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Highlights */}
          {insights.highlights && insights.highlights.length > 0 && (
            <HighlightsSection highlights={insights.highlights} t={t} />
          )}

          {/* Health Checks Grid */}
          {insights.checks && insights.checks.length > 0 && (
            <ChecksSection checks={insights.checks} t={t} />
          )}

          {/* Action Items */}
          {insights.action_items && insights.action_items.length > 0 && (
            <ActionItemsSection items={insights.action_items} t={t} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────

function GeneratingOverlay({ phase, t }: { phase: number; t: (k: string) => string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(162,155,254,0.15))',
              border: '1px solid rgba(108,92,231,0.30)',
              boxShadow: '0 0 40px rgba(108,92,231,0.20)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <Sparkles className="w-10 h-10" style={{ color: 'var(--brand-primary)' }} />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {t('insightsPage.overlay.title')}
          </h3>
          <p className="text-sm text-gray-300 transition-all duration-500" key={phase}>
            {t(OVERLAY_PHASES[phase] ?? OVERLAY_PHASES[0]!)}
          </p>
        </div>

        <div className="flex gap-2">
          {OVERLAY_PHASES.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i <= phase ? 'var(--brand-primary)' : 'rgba(255,255,255,0.15)',
                boxShadow: i === phase ? '0 0 8px var(--brand-primary)' : 'none',
              }}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500">{t('insightsPage.overlay.doNotLeave')}</p>
      </div>
    </div>
  );
}

function HealthScoreCard({ insights, t }: { insights: InsightsData; t: (k: string) => string }) {
  const healthStyle = (HEALTH_STYLES[insights.overall_health] ?? HEALTH_STYLES.good)!;
  const healthLabel =
    insights.overall_health === 'good' ? t('insightsPage.healthGood')
    : insights.overall_health === 'warning' ? t('insightsPage.healthWarning')
    : t('insightsPage.healthCritical');

  return (
    <div className="dashboard-card p-5 flex flex-col items-center justify-center gap-4">
      <ScoreRing score={insights.health_score ?? 0} size={120} label={t('insightsPage.healthScore')} />

      <span
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{
          color: healthStyle.text,
          background: healthStyle.bg,
          border: `1px solid ${healthStyle.border}`,
          boxShadow: healthStyle.glow,
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: healthStyle.text, boxShadow: `0 0 6px ${healthStyle.text}` }}
        />
        {healthLabel}
      </span>
    </div>
  );
}

function HighlightsSection({ highlights, t }: { highlights: InsightsHighlight[]; t: (k: string) => string }) {
  const HIGHLIGHT_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
    positive: { icon: TrendingUp, color: '#00cec9', bg: 'rgba(0,206,201,0.06)' },
    negative: { icon: TrendingDown, color: '#dc3545', bg: 'rgba(220,53,69,0.06)' },
    neutral:  { icon: Minus, color: '#6c757d', bg: 'rgba(108,117,125,0.06)' },
  };

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4" style={{ color: 'var(--brand-accent, #fdcb6e)' }} />
        <h3 className="text-sm font-semibold text-text-primary">{t('insightsPage.highlightsTitle')}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {highlights.map((h, i) => {
          const config = (HIGHLIGHT_CONFIG[h.type] ?? HIGHLIGHT_CONFIG.neutral)!;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-xl border transition-colors"
              style={{ background: config.bg, borderColor: `${config.color}15` }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${config.color}15` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{h.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecksSection({ checks, t }: { checks: InsightsCheck[]; t: (k: string) => string }) {
  const sortedChecks = [...checks].sort((a, b) => {
    const order: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
        <h3 className="text-sm font-semibold text-text-primary">{t('insightsPage.checksTitle')}</h3>
        <span className="text-xs text-text-muted">({checks.length})</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedChecks.map((check) => (
          <CheckCard key={check.id} check={check} t={t} />
        ))}
      </div>
    </div>
  );
}

function CheckCard({ check, t }: { check: InsightsCheck; t: (k: string) => string }) {
  const statusStyle = (STATUS_STYLES[check.status] ?? STATUS_STYLES.warning)!;
  const StatusIcon = (STATUS_ICONS[check.status] ?? AlertTriangle)!;
  const catConfig = (CATEGORY_CONFIG[check.category] ?? CATEGORY_CONFIG.visibility)!;
  const CatIcon = catConfig.icon;

  const statusLabel =
    check.status === 'pass' ? t('insightsPage.statusPass')
    : check.status === 'warning' ? t('insightsPage.statusWarning')
    : t('insightsPage.statusFail');

  return (
    <div
      className="rounded-xl border p-4 transition-all duration-200 hover:border-opacity-50"
      style={{ background: 'var(--bg-secondary)', borderColor: statusStyle.border }}
    >
      <div className="flex items-start gap-3 mb-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: statusStyle.bg }}
        >
          <StatusIcon className="w-4 h-4" style={{ color: statusStyle.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{check.title}</span>
            <span
              className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wider shrink-0"
              style={{ color: statusStyle.text, background: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <CatIcon className="w-3 h-3" style={{ color: catConfig.color }} />
            <span className="text-[10px] text-text-muted">{t(`insightsPage.${catConfig.i18nKey}`)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed mb-2">{check.detail}</p>

      {check.recommendation && check.status !== 'pass' && (
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
          style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.10)' }}
        >
          <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-text-secondary">{check.recommendation}</span>
        </div>
      )}
    </div>
  );
}

function ActionItemsSection({ items, t }: { items: InsightsActionItem[]; t: (k: string) => string }) {
  const sorted = [...items].sort((a, b) => a.priority - b.priority);

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4" style={{ color: 'var(--brand-accent, #fdcb6e)' }} />
        <h3 className="text-sm font-semibold text-text-primary">{t('insightsPage.actionItemsTitle')}</h3>
        <span className="text-xs text-text-muted">({items.length})</span>
      </div>

      <div className="space-y-3">
        {sorted.map((item, i) => {
          const catConfig = (CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.visibility)!;
          const CatIcon = catConfig.icon;
          const impactColor = IMPACT_COLORS[item.impact] || '#6c757d';
          const effortColor = IMPACT_COLORS[item.effort] || '#6c757d';

          const impactLabel =
            item.impact === 'high' ? t('insightsPage.impactHigh')
            : item.impact === 'medium' ? t('insightsPage.impactMedium')
            : t('insightsPage.impactLow');

          const effortLabel =
            item.effort === 'high' ? t('insightsPage.effortHigh')
            : item.effort === 'medium' ? t('insightsPage.effortMedium')
            : t('insightsPage.effortLow');

          return (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border transition-colors"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}
            >
              <span
                className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0"
                style={{
                  background: 'rgba(108,92,231,0.10)',
                  color: 'var(--brand-primary)',
                  border: '1px solid rgba(108,92,231,0.20)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                #{item.priority}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-text-primary">{item.title}</span>
                  <div className="flex items-center gap-1">
                    <CatIcon className="w-3 h-3" style={{ color: catConfig.color }} />
                    <span className="text-[10px] text-text-muted">{t(`insightsPage.${catConfig.i18nKey}`)}</span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed mb-2.5">{item.description}</p>

                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: impactColor, background: `${impactColor}10`, border: `1px solid ${impactColor}20` }}
                  >
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    {impactLabel}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: effortColor, background: `${effortColor}10`, border: `1px solid ${effortColor}20` }}
                  >
                    <Zap className="w-2.5 h-2.5" />
                    {effortLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
