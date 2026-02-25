import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertCircle, Loader2, Search, Database } from 'lucide-react';
import type { Prompt, Topic, Profile, TenantPlatformModel, PromptAnswer } from '@/types';

interface PromptHeaderProps {
  prompt: Prompt | null;
  topic: Topic | null;
  profile: Profile | null;
  searching: boolean;
  tenantModels: TenantPlatformModel[];
  answers: PromptAnswer[];
  error: string;
  onBack: () => void;
  onSearch: () => void;
}

export function PromptHeader({
  prompt,
  topic,
  profile,
  searching,
  tenantModels,
  answers,
  error,
  onBack,
  onSearch,
}: PromptHeaderProps) {
  const { t } = useTranslation();

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('promptDetail.backToPrompts')}
      </button>

      {error ? (
        <div className="p-4 rounded-xs bg-error/10 border border-error/20 text-error flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      ) : prompt && (
        <div className="dashboard-card p-6 border-l-4" style={{ borderLeftColor: 'var(--brand-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="badge">{topic?.name || t('topics.title')}</span>
            {prompt.is_active ? (
              <span className="text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium">
                {t('prompts.active')}
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded bg-text-muted/10 text-text-muted font-medium">
                {t('prompts.inactive')}
              </span>
            )}
            <div className="ml-auto">
              {profile?.is_sa && (
                <button
                  onClick={onSearch}
                  disabled={searching || tenantModels.length === 0}
                  className="btn btn-primary btn-sm"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('answers.searching')}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      {t('answers.search')}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <h1 className="text-lg font-medium text-text-primary mb-2">
            {prompt.text}
          </h1>
          {prompt.description && (
            <p className="text-sm text-text-muted">{prompt.description}</p>
          )}
          
          <div className="mt-4 pt-4 border-t border-glass-border flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              {t('promptDetail.answersCount', { count: answers.length })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
