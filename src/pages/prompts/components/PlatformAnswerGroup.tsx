import { useTranslation } from 'react-i18next';
import { 
  ChevronDown, 
  ChevronRight, 
  Link2, 
  AlertCircle 
} from 'lucide-react';
import type { PromptAnswer, Profile } from '@/types';
import type { PlatformGroup } from '@/types/dashboard';
import { PLATFORM_COLORS } from '@/types/dashboard';
import { AnswerItem } from './AnswerItem';

interface PlatformAnswerGroupProps {
  group: PlatformGroup;
  profile: Profile | null;
  isExpanded: boolean;
  onToggle: () => void;
  expandedAnswers: Set<string>;
  onToggleAnswer: (id: string) => void;
  onRetryAnswer: (answer: PromptAnswer) => void;
  retryingAnswerId: string | null;
}

export function PlatformAnswerGroup({
  group,
  profile,
  isExpanded,
  onToggle,
  expandedAnswers,
  onToggleAnswer,
  onRetryAnswer,
  retryingAnswerId,
}: PlatformAnswerGroupProps) {
  const { t } = useTranslation();

  let platformTotalAnswers = 0;
  let platformTotalErrors = 0;
  let platformTotalSources = 0;
  for (const m of group.models) {
    platformTotalAnswers += m.answers.length;
    platformTotalErrors += m.answers.filter((a: PromptAnswer) => a.error).length;
    platformTotalSources += m.answers.reduce((sum: number, a: PromptAnswer) => sum + (Array.isArray(a.sources) ? a.sources.length : 0), 0);
  }

  return (
    <div className="dashboard-card overflow-hidden">
      {/* Platform Header */}
      <div
        onClick={() => profile?.is_sa && onToggle()}
        className={`w-full p-4 flex items-center gap-3 text-left ${profile?.is_sa ? 'hover:bg-glass-hover transition-colors cursor-pointer select-none' : ''}`}
      >
        {profile?.is_sa && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
          )
        )}
        <span
          className={`w-3 h-3 rounded-full shrink-0 ${PLATFORM_COLORS[group.platform_slug] || 'bg-gray-500'}`}
        />
        <span className="font-semibold text-text-primary uppercase tracking-wide flex-1">
          {group.platform_slug}
        </span>
        <span className="text-xs text-text-muted">
          {platformTotalAnswers} {t('answers.results')}
        </span>
        {platformTotalSources > 0 && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            {platformTotalSources} {t('promptDetail.sources', 'sources')}
          </span>
        )}
        {platformTotalErrors > 0 && (
          <span className="text-xs text-error bg-error/10 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {platformTotalErrors}
          </span>
        )}
      </div>

      {/* Models list */}
      {profile?.is_sa && isExpanded && (
        <div className="border-t border-glass-border bg-bg-tertiary/30 p-4 space-y-4">
          {group.models.map((model: any) => (
            <div key={model.model_slug} className="space-y-2">
              <h3 className="text-sm font-medium text-text-secondary pl-2 flex items-center gap-2">
                <span className="text-text-muted">{t('promptDetail.model')}:</span> 
                {model.model_slug}
              </h3>
              
              <div className="space-y-1.5 pl-2 border-l border-glass-border ml-2">
                {model.answers.map((answer: PromptAnswer) => (
                  <AnswerItem
                    key={answer.id}
                    answer={answer}
                    profile={profile}
                    isExpanded={expandedAnswers.has(answer.id)}
                    onToggle={() => onToggleAnswer(answer.id)}
                    onRetry={() => onRetryAnswer(answer) }
                    isRetrying={retryingAnswerId === answer.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
