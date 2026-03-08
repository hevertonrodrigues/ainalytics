/**
 * GEO Analysis — Reusable display components.
 * All components accept data props so they can be reused
 * for both the company page and future competitor analysis pages.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
  BookOpen,
  Brain,
  ArrowUpRight,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import type {
  GeoFactorScore,
  GeoCategoryScores,
  GeoReadinessLevel,
  GeoNextLevel,
  GeoTopRecommendation,
} from '@/types';
import { READINESS_UI as READINESS_CONFIG, STATUS_COLORS } from '@/config/geo-readiness';

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  Technical: Shield,
  Content: BookOpen,
  Authority: Sparkles,
  Semantic: Brain,
  'Competitive Position': BarChart3,
};

const CATEGORY_COLORS: Record<string, string> = {
  Technical: '#6c5ce7',
  Content: '#fd79a8',
  Authority: '#00cec9',
  Semantic: '#ffeaa7',
  'Competitive Position': '#a29bfe',
};

// ─── GeoReadinessBadge ──────────────────────────────────────

interface GeoReadinessBadgeProps {
  level: GeoReadinessLevel;
  size?: 'sm' | 'md' | 'lg';
}

export function GeoReadinessBadge({ level, size = 'md' }: GeoReadinessBadgeProps) {
  const { t } = useTranslation();
  const config = READINESS_CONFIG[level] ?? READINESS_CONFIG[0]!;
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[10px]',
    md: 'px-3.5 py-1.5 text-xs',
    lg: 'px-5 py-2 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full ${sizeClasses[size]}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
        boxShadow: config.glow,
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: config.color, boxShadow: `0 0 6px ${config.color}` }}
      />
      {t('company.level')} {level}: {config.label}
    </span>
  );
}

// ─── ScoreRing (reusable, extracted from MyCompanyPage) ─────

interface ScoreRingProps {
  score: number;
  label?: string;
  color?: string;
  size?: number;
}

export function ScoreRing({ score, label, color, size = 96 }: ScoreRingProps) {
  const radius = (size / 2) - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const autoColor = score >= 90 ? '#00cec9'
    : score >= 75 ? '#28A745'
    : score >= 60 ? '#8BC34A'
    : score >= 40 ? '#FFC107'
    : score >= 20 ? '#E67C00'
    : '#DC3545';

  const ringColor = color || autoColor;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="-rotate-90" viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="var(--glass-border)" strokeWidth="6"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${ringColor}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
    </div>
  );
}

// ─── GeoScoreOverview ───────────────────────────────────────

interface GeoScoreOverviewProps {
  compositeScore: number;
  readinessLevel: GeoReadinessLevel;
  categoryScores: GeoCategoryScores;
  pointsToNextLevel: number;
  nextLevel: GeoNextLevel | null;
}

export function GeoScoreOverview({
  compositeScore,
  readinessLevel,
  categoryScores,
  pointsToNextLevel,
  nextLevel,
}: GeoScoreOverviewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="dashboard-card p-6">
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Brain className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
        <h3 className="text-sm font-semibold text-text-primary flex-1">{t('company.geoScoreOverview')}</h3>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </button>
      {!collapsed && (
        <div className="mt-4 flex flex-col md:flex-row items-center gap-6">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={compositeScore} size={120} label={t('company.geoScore')} />
            <GeoReadinessBadge level={readinessLevel} size="md" />
          </div>

          {/* Category breakdown */}
          <div className="flex-1 w-full">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              {t('company.categoryBreakdown')}
            </h4>
            <GeoCategoryBreakdown scores={categoryScores} />

            {/* Next level indicator */}
            {nextLevel && pointsToNextLevel > 0 && (
              <div
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{
                  background: 'rgba(108,92,231,0.06)',
                  border: '1px solid rgba(108,92,231,0.15)',
                }}
              >
                <ArrowUpRight className="w-3.5 h-3.5" style={{ color: 'var(--brand-primary)' }} />
                <span className="text-text-secondary">
                  <span className="font-semibold text-text-primary">{(pointsToNextLevel ?? 0).toFixed(1)} {t('company.points')}</span>{' '}
                  {t('company.toReach')} <span className="font-semibold" style={{ color: READINESS_CONFIG[nextLevel.level]?.color }}>{t('company.level')} {nextLevel.level}: {nextLevel.label}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GeoCategoryBreakdown ───────────────────────────────────

interface GeoCategoryBreakdownProps {
  scores: GeoCategoryScores;
}

export function GeoCategoryBreakdown({ scores }: GeoCategoryBreakdownProps) {
  const { t } = useTranslation();

  const CAT_I18N: Record<string, string> = {
    Technical: 'catTechnical',
    Content: 'catContent',
    Authority: 'catAuthority',
    Semantic: 'catSemantic',
    'Competitive Position': 'catCompetitivePosition',
  };

  const categories = [
    { key: 'technical', catKey: 'Technical', score: scores.technical },
    { key: 'content', catKey: 'Content', score: scores.content },
    { key: 'authority', catKey: 'Authority', score: scores.authority },
    { key: 'semantic', catKey: 'Semantic', score: scores.semantic },
    ...(scores.competitive_position != null
      ? [{ key: 'competitive_position', catKey: 'Competitive Position', score: scores.competitive_position }]
      : []),
  ];

  return (
    <div className="space-y-2.5">
      {categories.map((cat) => {
        const Icon = CATEGORY_ICONS[cat.catKey] || Shield;
        const color = CATEGORY_COLORS[cat.catKey] || '#6c5ce7';
        const label = t(`company.${CAT_I18N[cat.catKey] || 'catTechnical'}`);
        return (
          <div key={cat.key} className="flex items-center gap-3">
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            <span className="text-xs font-medium text-text-secondary w-20 shrink-0">{label}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(cat.score, 100)}%`, background: color, boxShadow: `0 0 8px ${color}30` }}
              />
            </div>
            <span className="text-xs font-bold text-text-primary w-10 text-right" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {Math.round(cat.score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── GeoFactorCard ──────────────────────────────────────────

interface GeoFactorCardProps {
  factor: GeoFactorScore;
}

const STATUS_I18N: Record<string, string> = {
  excellent: 'statusExcellent',
  good: 'statusGood',
  warning: 'statusWarning',
  critical: 'statusCritical',
};

const CAT_I18N_MAP: Record<string, string> = {
  Technical: 'catTechnical',
  Content: 'catContent',
  Authority: 'catAuthority',
  Semantic: 'catSemantic',
  'Competitive Position': 'catCompetitivePosition',
};

export function GeoFactorCard({ factor }: GeoFactorCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const colors = STATUS_COLORS[factor.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.warning;
  const Icon = CATEGORY_ICONS[factor.category] || Shield;
  const statusLabel = t(`company.${STATUS_I18N[factor.status] || 'statusWarning'}`);
  const categoryLabel = t(`company.${CAT_I18N_MAP[factor.category] || 'catTechnical'}`);

  return (
    <div
      className="rounded-xl border transition-all duration-200 hover:border-opacity-50"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: colors.border,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        id={`geo-factor-${factor.factor_id}`}
      >
        {/* Score */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: colors.bg,
            color: colors.text,
            fontFamily: 'JetBrains Mono, monospace',
            border: `1px solid ${colors.border}`,
          }}
        >
          {Math.round(factor.score)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{factor.name}</span>
            <span
              className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wider shrink-0"
              style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}
            >
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon className="w-3 h-3" style={{ color: CATEGORY_COLORS[factor.category] || '#6c5ce7' }} />
            <span className="text-[10px] text-text-muted">{categoryLabel}</span>
            <span className="text-[10px] text-text-muted">·</span>
            <span className="text-[10px] text-text-muted" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              w={factor.weight}
            </span>
          </div>
        </div>

        {/* Score bar mini */}
        <div className="hidden sm:flex items-center gap-2 w-24 shrink-0">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(factor.score, 100)}%`, background: colors.text }}
            />
          </div>
        </div>

        {/* Expand icon */}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
          : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        }
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          <p className="text-xs text-text-secondary leading-relaxed mt-3 mb-2">{factor.details}</p>
          {factor.recommendations.length > 0 && (
            <div className="space-y-1.5">
              {factor.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Lightbulb className="w-3 h-3 text-brand-accent mt-0.5 shrink-0" />
                  <span className="text-text-secondary">{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GeoFactorScorecard ─────────────────────────────────────

type CategoryFilter = 'all' | 'Technical' | 'Content' | 'Authority' | 'Semantic';

interface GeoFactorScorecardProps {
  factors: GeoFactorScore[];
}

export function GeoFactorScorecard({ factors }: GeoFactorScorecardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<'score' | 'weight'>('score');

  const filteredFactors = factors
    .filter((f) => filter === 'all' || f.category === filter)
    .sort((a, b) => {
      if (sortBy === 'score') return a.score - b.score; // Worst first
      return b.weight - a.weight; // Heaviest first
    });

  const tabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: `${t('company.allFactors')} (${factors.length})` },
    { key: 'Technical', label: t('company.catTechnical') },
    { key: 'Content', label: t('company.catContent') },
    { key: 'Authority', label: t('company.catAuthority') },
    { key: 'Semantic', label: t('company.catSemantic') },
  ];

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1"
          onClick={() => setCollapsed((c) => !c)}
        >
          <Shield className="w-4 h-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 flex-1">
            {t('company.geoFactorScorecard')}
            <span className="text-xs text-text-muted font-normal">({factors.length} {t('company.factors')})</span>
          </h3>
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
          ) : (
            <ChevronUp className="w-4 h-4 text-text-muted shrink-0" />
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1 ml-3">
            <button
              onClick={() => setSortBy('score')}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                sortBy === 'score' ? 'bg-brand-primary/20 text-brand-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t('company.byScore')}
            </button>
            <button
              onClick={() => setSortBy('weight')}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                sortBy === 'weight' ? 'bg-brand-primary/20 text-brand-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t('company.byWeight')}
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Category tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-all ${
                  filter === tab.key
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
                style={filter === tab.key ? { boxShadow: '0 0 12px rgba(108,92,231,0.25)' } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Factor list */}
          <div className="space-y-2">
            {filteredFactors.map((factor) => (
              <GeoFactorCard key={factor.factor_id} factor={factor} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── GeoRecommendations ─────────────────────────────────────

interface GeoRecommendationsProps {
  recommendations: GeoTopRecommendation[];
}

export function GeoRecommendations({ recommendations }: GeoRecommendationsProps) {
  if (!recommendations.length) return null;

  return (
    <div className="dashboard-card p-5">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-brand-accent" />
        Top Priority Improvements & Recommendations
        <span className="text-xs text-text-muted font-normal">(highest impact)</span>
      </h3>
      <div className="space-y-2.5">
        {recommendations.map((rec) => (
          <div
            key={rec.factor_id}
            className="flex items-start gap-3 p-3 rounded-xl border transition-colors"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
              style={{
                background: 'rgba(108,92,231,0.10)',
                color: 'var(--brand-primary)',
                border: '1px solid rgba(108,92,231,0.20)',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              #{rec.priority}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary">{rec.factor_name}</span>
                <span className="text-[10px] text-text-muted" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {rec.current_score}→{rec.estimated_score_after_fix}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{rec.recommendation}</p>
              <span
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--success)' }}
              >
                <ArrowUpRight className="w-3 h-3" />
                +{(rec.potential_composite_gain ?? 0).toFixed(1)} composite points
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { ImprovementsAndRecommendations } from './ImprovementsAndRecommendations';
