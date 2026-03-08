/**
 * ImprovementsAndRecommendations — Renders Deep Analyze improvement
 * suggestions with criticality badges and impacted metric tags.
 * Used by MyCompanyPage and DeepAnalyzePage.
 *
 * GEO factor recommendations are NOT shown here — they live in the
 * GEO Factor Scorecard instead.
 */
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';
import type { DeepAnalyzeImprovement } from '@/types';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

// ─── Metric color config (for tags) ─────────────────────────
const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  semantic:              { label: 'Semantic',              color: '#6c5ce7' },
  content:               { label: 'Content',               color: '#fd79a8' },
  authority:             { label: 'Authority',             color: '#00cec9' },
  technical:             { label: 'Technical',             color: '#fdcb6e' },
  competitive_position:  { label: 'Competitive Position',  color: '#a29bfe' },
};

// ─── Criticality config ─────────────────────────────────────
const CRITICALITY_COLORS = {
  high:   { bg: 'rgba(255,107,107,0.10)', text: '#ff6b6b', border: 'rgba(255,107,107,0.25)' },
  medium: { bg: 'rgba(253,203,110,0.10)', text: '#fdcb6e', border: 'rgba(253,203,110,0.25)' },
  low:    { bg: 'rgba(0,206,201,0.10)',   text: '#00cec9', border: 'rgba(0,206,201,0.25)' },
} as const;

function getCriticalityLevel(level: number): 'high' | 'medium' | 'low' {
  if (level >= 7) return 'high';
  if (level >= 4) return 'medium';
  return 'low';
}

// ─── Props ──────────────────────────────────────────────────
interface Props {
  improvements?: DeepAnalyzeImprovement[];
}

export function ImprovementsAndRecommendations({ improvements = [] }: Props) {
  const { t } = useTranslation();

  if (!improvements.length) return null;

  // Sort by criticality (desc), then priority (asc)
  const sorted = [...improvements].sort((a, b) => {
    if (b.criticality_level !== a.criticality_level) return b.criticality_level - a.criticality_level;
    return a.priority_rank - b.priority_rank;
  });

  return (
    <CollapsibleSection
      title={t('company.deepImprovements')}
      icon={Lightbulb}
      iconColor="var(--brand-accent)"
      badge={`(${sorted.length})`}
    >
      <div className="space-y-2.5">
        {sorted.map((imp, idx) => {
          const level = getCriticalityLevel(imp.criticality_level);
          const colors = CRITICALITY_COLORS[level];

          return (
            <div
              key={imp.priority_rank}
              className="flex items-start gap-3 p-3 rounded-xl border transition-colors"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}
            >
              {/* Priority rank */}
              <span
                className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
                style={{
                  background: 'rgba(108,92,231,0.10)',
                  color: 'var(--brand-primary)',
                  border: '1px solid rgba(108,92,231,0.20)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                #{idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">{imp.title}</span>
                  {/* Criticality badge */}
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                    style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}
                  >
                    {imp.criticality_level}/10
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-2">{imp.description}</p>

                {/* Impacted metrics tags */}
                {imp.impacted_metrics?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {imp.impacted_metrics.map((metric: string) => {
                      const cfg = METRIC_CONFIG[metric];
                      return (
                        <span
                          key={metric}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color: cfg?.color || '#999',
                            background: `${cfg?.color || '#999'}15`,
                            border: `1px solid ${cfg?.color || '#999'}30`,
                          }}
                        >
                          {cfg?.label || metric}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
