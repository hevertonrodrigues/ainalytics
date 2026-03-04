import { useTranslation } from 'react-i18next';
import { Sparkles, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { PreAnalyzeResult } from './types';
import { CATEGORY_COLORS, READINESS_BADGES } from './types';

interface AnalyzeResultsProps {
  result: PreAnalyzeResult;
  onShowCategoryInfo: () => void;
  children?: React.ReactNode;
}

export function AnalyzeResults({ result, onShowCategoryInfo, children }: AnalyzeResultsProps) {
  const { t } = useTranslation();

  return (
    <div key="result" className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Top hero: company info + quick checks */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-10 mb-6">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Company info */}
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">
              {result.website_title || result.domain}
            </h2>
            <p className="text-sm text-text-muted mb-3">{result.domain}</p>

            {/* Readiness badge */}
            {(() => {
              const badge = READINESS_BADGES[result.readiness_level] ?? READINESS_BADGES[0]!;
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color} ${badge.bg}`}>
                  <Sparkles className="w-3 h-3" />
                  {result.readiness_label || badge.label}
                </span>
              );
            })()}

            {result.next_level && result.points_to_next_level > 0 && (
              <p className="text-xs text-text-muted mt-2">
                {t('onboarding.analyze.pointsToNext', {
                  points: result.points_to_next_level,
                  level: result.next_level.label,
                })}
              </p>
            )}
          </div>

          {/* Right: Quick checks */}
          <div className="space-y-2.5">
            {[
              { label: 'robots.txt', has: result.robots_txt },
              { label: 'sitemap.xml', has: result.sitemap_xml },
              { label: 'llms.txt', has: result.llms_txt },
            ].map(({ label, has }) => (
              <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-primary/30">
                {has ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                )}
                <span className="text-sm font-mono text-text-secondary">{label}</span>
                <span className={`ml-auto text-xs font-medium ${has ? 'text-success' : 'text-warning'}`}>
                  {has ? t('common.found') : t('common.missing')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t('onboarding.analyze.categoriesTitle')}
        </h3>
        <button
          onClick={onShowCategoryInfo}
          className="p-1 rounded-lg hover:bg-glass-hover transition-colors text-text-muted hover:text-text-primary"
          title={t('onboarding.analyze.categoriesInfoTitle')}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(result.category_scores).map(([cat, score]) => (
          <div key={cat} className="dashboard-card p-4 text-center">
            <div
              className="w-3 h-3 rounded-full mx-auto mb-2"
              style={{ backgroundColor: CATEGORY_COLORS[cat] || '#6c5ce7' }}
            />
            <div className="text-lg font-bold text-text-primary">{Math.round(score as number)}</div>
            <div className="text-xs text-text-muted capitalize">{t(`onboarding.analyze.categories.${cat}`, cat)}</div>
          </div>
        ))}
      </div>

      {/* Improvements teaser */}
      {result.top_recommendations.length > 0 && (
        <div className="dashboard-card p-5 mb-6 text-center">
          <p className="text-lg font-bold text-brand-primary">
            +25 {t('onboarding.analyze.improvementsFound')}
          </p>
        </div>
      )}

      {/* Plans slot (rendered by parent) */}
      {children}
    </div>
  );
}
