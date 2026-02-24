import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  Cpu,
  RefreshCw,
  Link2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Prompt, PromptAnswer, Topic, TenantPlatformModel } from '@/types';

export function TopicAnswersPage() {
  const { id: topicId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { showToast } = useToast();
  const { profile } = useAuth();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [tenantModels, setTenantModels] = useState<TenantPlatformModel[]>([]);
  const [answers, setAnswers] = useState<PromptAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchingPromptId, setSearchingPromptId] = useState<string | null>(null);
  const [retryingAnswerId, setRetryingAnswerId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    if (!topicId) return;
    try {
      // Load topic details
      const topicRes = await apiClient.get<Topic>(`/topics-prompts?id=${topicId}`);
      setTopic(topicRes.data);

      // Load prompts for this topic
      const promptsRes = await apiClient.get<Prompt[]>(
        `/topics-prompts/prompts?topicId=${topicId}`,
      );
      setPrompts(promptsRes.data);

      // Load tenant's active models
      const modelsRes = await apiClient.get<TenantPlatformModel[]>('/platforms/preferences');
      const activeModels = modelsRes.data.filter((m: TenantPlatformModel) => m.is_active);
      setTenantModels(activeModels);

      // Load existing answers
      const answersRes = await apiClient.get<PromptAnswer[]>(
        `/prompt-search?topicId=${topicId}`,
      );
      setAnswers(answersRes.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [topicId, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSearch = async (prompt: Prompt) => {
    if (tenantModels.length === 0) {
      setError(t('answers.noPlatformsEnabled'));
      return;
    }

    setSearchingPromptId(prompt.id);
    setError('');

    try {
      const res = await apiClient.post<PromptAnswer[]>('/prompt-search', {
        prompt_id: prompt.id,
        prompt_text: prompt.text,
      });

      setAnswers((prev) => [...res.data, ...prev]);
      setExpandedPrompts((prev) => new Set([...prev, prompt.id]));
      showToast(t('answers.searchComplete'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSearchingPromptId(null);
    }
  };

  // Retry a single failed answer via the new /retry endpoint
  const handleRetrySingle = async (answer: PromptAnswer) => {
    setRetryingAnswerId(answer.id);
    setError('');

    try {
      const res = await apiClient.post<PromptAnswer>('/prompt-search/retry', {
        answer_id: answer.id,
      });

      const newAnswer = res.data;

      setAnswers((prev) => {
        // If retry succeeded, remove the old answer (it's now deleted server-side)
        // If retry failed again, keep both
        if (!newAnswer.error) {
          const filtered = prev.filter((a) => a.id !== answer.id);
          return [newAnswer, ...filtered];
        }
        return [newAnswer, ...prev];
      });
      showToast(newAnswer.error ? t('common.error') : t('answers.retryComplete'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      showToast(msg, 'error');
    } finally {
      setRetryingAnswerId(null);
    }
  };

  const togglePromptExpand = (promptId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const toggleAnswerExpand = (answerId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return next;
    });
  };

  const getAnswersForPrompt = (promptId: string) =>
    answers.filter((a) => a.prompt_id === promptId);



  const PLATFORM_COLORS: Record<string, string> = {
    openai: 'bg-emerald-500',
    anthropic: 'bg-orange-500',
    gemini: 'bg-blue-500',
    grok: 'bg-slate-600',
    perplexity: 'bg-cyan-500',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-card p-5">
              <div className="skeleton h-5 w-64 mb-2" />
              <div className="skeleton h-3 w-96" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/dashboard/topics/${topicId}`)} className="icon-btn">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary">
            {t('answers.title')}
          </h1>
          {topic && (
            <p className="text-sm text-text-muted mt-0.5">
              {topic.name} — {prompts.length} {t('topics.promptCount').toLowerCase()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            <Cpu className="w-3.5 h-3.5 inline mr-1" />
            {tenantModels.length} {t('answers.activeModels')}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* No active models warning */}
      {tenantModels.length === 0 && (
        <div className="dashboard-card p-4 border-warning/20">
          <p className="text-sm text-warning flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {t('answers.noPlatformsEnabled')}
          </p>
        </div>
      )}

      {/* Prompts List */}
      {prompts.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <Search className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('answers.noPrompts')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => {
            const promptAnswers = getAnswersForPrompt(prompt.id);
            const allPromptAnswers = promptAnswers;
            const isExpanded = expandedPrompts.has(prompt.id);
            const isSearching = searchingPromptId === prompt.id;

            return (
              <div key={prompt.id} className="dashboard-card overflow-hidden">
                {/* Prompt header */}
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => togglePromptExpand(prompt.id)}
                    className="icon-btn shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => togglePromptExpand(prompt.id)}>
                    <p className="text-sm font-medium text-text-primary truncate">
                      {prompt.text}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {allPromptAnswers.length > 0 && (
                        <span className="text-xs text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {allPromptAnswers.length} {t('answers.results')}
                        </span>
                      )}
                      {promptAnswers.length > 0 && (
                        <div className="flex items-center gap-1">
                          {promptAnswers.map((a) => (
                            <span
                              key={a.id}
                              className={`w-2 h-2 rounded-full ${
                                a.error
                                  ? 'bg-error'
                                  : PLATFORM_COLORS[a.platform_slug] || 'bg-gray-500'
                              }`}
                              title={`${a.platform_slug}: ${a.error || 'OK'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {profile?.is_sa && (
                    <button
                      onClick={() => handleSearch(prompt)}
                      disabled={isSearching || tenantModels.length === 0}
                      className="btn btn-primary btn-sm shrink-0"
                    >
                      {isSearching ? (
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

                {/* Expanded results for SAs */}
                {profile?.is_sa && isExpanded && promptAnswers.length > 0 && (
                  <div className="border-t border-glass-border">
                    {promptAnswers.map((answer) => {
                      const isAnswerExpanded = expandedAnswers.has(answer.id);
                      return (
                        <div
                          key={answer.id}
                          className="border-b border-glass-border/50 last:border-0"
                        >
                          <div
                            className={`flex items-center gap-2 p-4 transition-colors select-none ${profile?.is_sa ? 'cursor-pointer hover:bg-glass-bg/50' : ''}`}
                            onClick={() => profile?.is_sa && toggleAnswerExpand(answer.id)}
                          >
                            {profile?.is_sa && (
                              isAnswerExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              )
                            )}
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                answer.error
                                  ? 'bg-error'
                                  : PLATFORM_COLORS[answer.platform_slug] || 'bg-gray-500'
                              }`}
                            />
                            <span className="text-xs font-semibold text-text-primary uppercase">
                              {answer.platform_slug}
                            </span>
                            <span className="text-xs text-text-muted">{answer.model?.slug ?? answer.model_id}</span>
                            {answer.error && (
                              <span className="text-xs text-error">
                                <AlertCircle className="w-3 h-3 inline" />
                              </span>
                            )}

                            {Array.isArray(answer.sources) && answer.sources.length > 0 && (
                              <span className="text-xs text-text-muted ml-auto flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                {answer.sources.length} {t('promptDetail.sources', 'sources')}
                              </span>
                            )}

                            {profile?.is_sa && answer.latency_ms && (
                              <span className={`text-xs text-text-muted flex items-center gap-1 ${!(Array.isArray(answer.sources) && answer.sources.length > 0) ? 'ml-auto' : ''}`}>
                                <Clock className="w-3 h-3" />
                                {(answer.latency_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                            {profile?.is_sa && answer.tokens_used && (
                              <span className="text-xs text-text-muted">
                                {answer.tokens_used.input + answer.tokens_used.output} tokens
                              </span>
                            )}
                          </div>

                          {profile?.is_sa && isAnswerExpanded && (
                            <div className="px-4 pb-4 pt-0 pl-10">
                              {answer.error ? (
                                <div className="p-2 rounded-xs bg-error/10 text-error text-xs flex items-center justify-between gap-2">
                                  <span className="flex-1 min-w-0">{answer.error}</span>
                                  {profile?.is_sa && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRetrySingle(answer); }}
                                      disabled={retryingAnswerId === answer.id}
                                      className="btn btn-ghost btn-sm text-error shrink-0 gap-1"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${retryingAnswerId === answer.id ? 'animate-spin' : ''}`} />
                                      {t('answers.retry')}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                  {answer.answer_text}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expanded results for non-SAs */}
                {!profile?.is_sa && isExpanded && promptAnswers.length > 0 && (
                  <div className="border-t border-glass-border p-4 flex flex-wrap gap-4 bg-bg-tertiary/20">
                    {Object.values(promptAnswers.reduce((acc, ans) => {
                      let group = acc[ans.platform_slug];
                      if (!group) {
                        group = { slug: ans.platform_slug, count: 0, errors: false };
                        acc[ans.platform_slug] = group;
                      }
                      group.count += Array.isArray(ans.sources) ? ans.sources.length : 0;
                      if (ans.error) group.errors = true;
                      return acc;
                    }, {} as Record<string, { slug: string; count: number; errors: boolean }>)).map(p => (
                      <div key={p.slug} className="flex items-center gap-2 p-3 bg-bg-secondary rounded-lg border border-glass-border shadow-sm">
                        <span className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[p.slug] || 'bg-gray-500'}`} />
                        <span className="text-sm font-semibold text-text-primary uppercase tracking-wide">{p.slug}</span>
                        {p.count > 0 && (
                          <span className="text-xs text-text-muted flex items-center gap-1 ml-2 pl-2 border-l border-glass-border">
                            <Link2 className="w-3 h-3" />
                            {p.count} {t('promptDetail.sources', 'sources')}
                          </span>
                        )}
                        {p.errors && <AlertCircle className="w-4 h-4 text-error ml-1" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state when expanded */}
                {isExpanded && promptAnswers.length === 0 && (
                  <div className="border-t border-glass-border p-6 text-center">
                    <p className="text-xs text-text-muted">{t('answers.noResults')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
