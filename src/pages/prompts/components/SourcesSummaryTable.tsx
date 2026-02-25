import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { PromptSource, PLATFORM_COLORS } from '@/types/dashboard';

interface SourcesSummaryTableProps {
  sources: PromptSource[];
}

export function SourcesSummaryTable({ sources }: SourcesSummaryTableProps) {
  const { t } = useTranslation();

  if (sources.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-base font-semibold text-text-primary">
          {t('promptDetail.sourcesSummary', 'Sources Summary')}
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-medium">
          {sources.length} {t('promptDetail.uniqueSources', 'unique sites')}
        </span>
      </div>

      <div className="dashboard-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-tertiary/50 border-b border-glass-border">
                <th className="px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('sources.domain', 'Source / Domain')}
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider text-center">
                  {t('promptDetail.totalMentions', 'Total Mentions')}
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t('promptDetail.platforms', 'Platforms')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {sources.map((source, idx) => (
                <tr key={source.domain + idx} className="hover:bg-glass-hover transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary/20 transition-colors">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {source.domain}
                        </div>
                        {source.name && (
                          <div className="text-xs text-text-muted line-clamp-1">
                            {source.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-semibold text-text-primary">
                      {source.total_count}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(source.platforms).map(([slug, count]) => (
                        <div
                          key={slug}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-glass-card border border-glass-border"
                          title={`${slug}: ${count} mentions`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[slug] || 'bg-gray-500'}`}
                          />
                          <span className="text-[10px] font-medium text-text-secondary uppercase">
                            {slug}
                          </span>
                          <span className="text-[10px] font-bold text-text-muted bg-text-muted/10 px-1 rounded">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
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
