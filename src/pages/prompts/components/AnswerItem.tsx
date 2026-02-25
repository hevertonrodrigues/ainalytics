import { useTranslation } from 'react-i18next';
import { 
  ChevronDown, 
  ChevronRight, 
  Link2, 
  Clock, 
  RefreshCw 
} from 'lucide-react';
import type { PromptAnswer, Profile } from '@/types';

interface AnswerItemProps {
  answer: PromptAnswer;
  profile: Profile | null;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}

export function AnswerItem({
  answer,
  profile,
  isExpanded,
  onToggle,
  onRetry,
  isRetrying,
}: AnswerItemProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-bg-primary rounded-lg border border-glass-border overflow-hidden">
      <div
        className={`flex items-center gap-3 p-3 transition-colors select-none ${profile?.is_sa ? 'cursor-pointer hover:bg-glass-hover' : ''}`}
        onClick={() => profile?.is_sa && onToggle()}
      >
        {profile?.is_sa && (
          isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
          )
        )}
        
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {profile?.is_sa && (
            <span className="text-xs text-text-secondary">
              {new Date(answer.created_at).toLocaleString()}
            </span>
          )}
          {answer.error && (
            <span className="text-xs text-error font-medium px-1.5 py-0.5 rounded bg-error/10">
              Error
            </span>
          )}
        </div>

        {Array.isArray(answer.sources) && answer.sources.length > 0 && (
          <span className="text-xs text-text-muted flex items-center gap-1 shrink-0">
            <Link2 className="w-3 h-3" />
            {answer.sources.length} {t('promptDetail.sources', 'sources')}
          </span>
        )}

        {profile?.is_sa && answer.latency_ms && (
          <span className="text-xs text-text-muted flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {(answer.latency_ms / 1000).toFixed(1)}s
          </span>
        )}
        {profile?.is_sa && answer.tokens_used && (
          <span className="text-xs text-text-muted shrink-0">
            {(answer.tokens_used.input || 0) + (answer.tokens_used.output || 0)} {t('promptDetail.tokens')}
          </span>
        )}
      </div>

      {profile?.is_sa && isExpanded && (
        <div className="px-4 pb-4 pt-1 pl-10 border-t border-glass-border/50 bg-bg-secondary/30">
          {answer.error ? (
            <div className="p-3 rounded-xs bg-error/10 text-error text-xs flex flex-col gap-2 mt-2">
              <div className="font-mono whitespace-pre-wrap">{answer.error}</div>
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                disabled={isRetrying}
                className="btn btn-primary btn-sm mt-1 self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                {t('answers.retry')}
              </button>
            </div>
          ) : (
            <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed mt-2 p-3 bg-bg-primary rounded-md border border-glass-border max-h-[500px] overflow-y-auto">
              {answer.answer_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
