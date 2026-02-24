import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  RefreshCw,
  Search,
  Loader2,
  Link2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Prompt, PromptAnswer, Topic, TenantPlatformModel } from '@/types';

type PlatformGroup = {
  platform_slug: string;
  models: {
    model_id: string;
    model_slug: string;
    answers: PromptAnswer[];
  }[];
};

const PLATFORM_COLORS: Record<string, string> = {
  openai: 'bg-emerald-500',
  anthropic: 'bg-orange-500',
  gemini: 'bg-blue-500',
  grok: 'bg-slate-600',
  perplexity: 'bg-cyan-500',
};

export function PromptDetailPage() {
  const { id: promptId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile } = useAuth();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [answers, setAnswers] = useState<PromptAnswer[]>([]);
  const [tenantModels, setTenantModels] = useState<TenantPlatformModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  
  const [retryingAnswerId, setRetryingAnswerId] = useState<string | null>(null);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    if (!promptId) return;
    try {
      // 1. Fetch the prompt's answers
      const answersRes = await apiClient.get<PromptAnswer[]>(
        `/prompt-search?promptId=${promptId}`,
      );
      setAnswers(answersRes.data);

      // 2. Load tenant's active models
      const modelsRes = await apiClient.get<TenantPlatformModel[]>('/platforms/preferences');
      setTenantModels(modelsRes.data.filter((m: TenantPlatformModel) => m.is_active));

      // 2. We need the prompt info. The easiest way is to fetch all topics/prompts 
      // and find it, since we don't have a single GET /prompts/:id endpoint.
      const topicsRes = await apiClient.get<Topic[]>('/topics-prompts');
      const allTopics = topicsRes.data;
      
      let foundPrompt: Prompt | null = null;
      let foundTopic: Topic | null = null;

      // Find the topic that contains this prompt
      for (const t of allTopics) {
        const promptsRes = await apiClient.get<Prompt[]>(`/topics-prompts/prompts?topicId=${t.id}`);
        const p = promptsRes.data.find(p => p.id === promptId);
        if (p) {
          foundPrompt = p;
          foundTopic = t;
          break;
        }
      }

      if (foundPrompt) {
        setPrompt(foundPrompt);
        setTopic(foundTopic);
      } else {
        setError(t('errors.NOT_FOUND'));
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [promptId, t]);

  const handleSearch = async () => {
    if (!prompt || tenantModels.length === 0) return;
    setSearching(true);
    setError('');
    try {
      const res = await apiClient.post<PromptAnswer[]>('/prompt-search', {
        prompt_id: prompt.id,
        prompt_text: prompt.text,
      });
      setAnswers(prev => [...res.data, ...prev]);
      showToast(t('answers.searchComplete'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      showToast(msg, 'error');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Group answers by platform -> model
  const groupedAnswers = useMemo(() => {
    const groups = new Map<string, Map<string, PromptAnswer[]>>();

    for (const ans of answers) {
      if (!groups.has(ans.platform_slug)) {
        groups.set(ans.platform_slug, new Map());
      }
      const pGroup = groups.get(ans.platform_slug)!;
      
      const modelSlug = ans.model?.slug || ans.model_id || 'unknown';
      if (!pGroup.has(modelSlug)) {
        pGroup.set(modelSlug, []);
      }
      pGroup.get(modelSlug)!.push(ans);
    }

    // Convert to array and sort natively
    const result: PlatformGroup[] = [];
    for (const [platform_slug, modelsMap] of groups.entries()) {
      const models = [];
      for (const [model_slug, modelAnswers] of modelsMap.entries()) {
        if (modelAnswers.length === 0) continue;
        
        // sort answers by created_at desc
        modelAnswers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        models.push({
          model_id: modelAnswers[0]!.model_id || 'unknown',
          model_slug,
          answers: modelAnswers,
        });
      }
      // sort models alphabetically
      models.sort((a, b) => a.model_slug.localeCompare(b.model_slug));
      
      result.push({ platform_slug, models });
    }
    
    // sort platforms alphabetically
    result.sort((a, b) => a.platform_slug.localeCompare(b.platform_slug));
    
    return result;
  }, [answers]);

  // Expand all platforms by default on first load
  useEffect(() => {
    if (groupedAnswers.length > 0 && expandedPlatforms.size === 0) {
      setExpandedPlatforms(new Set(groupedAnswers.map(g => g.platform_slug)));
    }
  }, [groupedAnswers]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetrySingle = async (answer: PromptAnswer) => {
    setRetryingAnswerId(answer.id);
    try {
      const res = await apiClient.post<PromptAnswer>('/prompt-search/retry', {
        answer_id: answer.id,
      });

      const newAnswer = res.data;
      setAnswers((prev) => {
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

  const togglePlatform = (slug: string) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
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

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="skeleton h-5 w-32" />
        <div className="dashboard-card p-6 space-y-3">
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="dashboard-card p-4">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6 max-w-5xl">
      {/* Header & Prompt Info */}
      <div>
        <button
          onClick={() => navigate('/dashboard/prompts')}
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
                    onClick={handleSearch}
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

      {/* Answers Grouped by Platform */}
      {!error && groupedAnswers.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <Database className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('promptDetail.noAnswers')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-base font-semibold text-text-primary px-1">
            {t('promptDetail.answersGrouped')}
          </h2>

          <div className="space-y-4">
            {groupedAnswers.map(group => {
              const isPlatformExpanded = expandedPlatforms.has(group.platform_slug);
              
              let platformTotalAnswers = 0;
              let platformTotalErrors = 0;
              let platformTotalSources = 0;
              for (const m of group.models) {
                platformTotalAnswers += m.answers.length;
                platformTotalErrors += m.answers.filter(a => a.error).length;
                platformTotalSources += m.answers.reduce((sum, a) => sum + (Array.isArray(a.sources) ? a.sources.length : 0), 0);
              }

              return (
                <div key={group.platform_slug} className="dashboard-card overflow-hidden">
                  {/* Platform Header */}
                  <div
                    onClick={() => profile?.is_sa && togglePlatform(group.platform_slug)}
                    className={`w-full p-4 flex items-center gap-3 text-left ${profile?.is_sa ? 'hover:bg-glass-hover transition-colors cursor-pointer select-none' : ''}`}
                  >
                    {profile?.is_sa && (
                      isPlatformExpanded ? (
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
                  {profile?.is_sa && isPlatformExpanded && (
                    <div className="border-t border-glass-border bg-bg-tertiary/30 p-4 space-y-4">
                      {group.models.map(model => (
                        <div key={model.model_slug} className="space-y-2">
                          <h3 className="text-sm font-medium text-text-secondary pl-2 flex items-center gap-2">
                            <span className="text-text-muted">{t('promptDetail.model')}:</span> 
                            {model.model_slug}
                          </h3>
                          
                          <div className="space-y-1.5 pl-2 border-l border-glass-border ml-2">
                            {model.answers.map(answer => {
                              const isAnswerExpanded = expandedAnswers.has(answer.id);
                              return (
                                <div key={answer.id} className="bg-bg-primary rounded-lg border border-glass-border overflow-hidden">
                                  <div
                                    className={`flex items-center gap-3 p-3 transition-colors select-none ${profile?.is_sa ? 'cursor-pointer hover:bg-glass-hover' : ''}`}
                                    onClick={() => profile?.is_sa && toggleAnswerExpand(answer.id)}
                                  >
                                    {profile?.is_sa && (
                                      isAnswerExpanded ? (
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
                                        {answer.tokens_used.input + answer.tokens_used.output} {t('promptDetail.tokens')}
                                      </span>
                                    )}
                                  </div>

                                  {profile?.is_sa && isAnswerExpanded && (
                                    <div className="px-4 pb-4 pt-1 pl-10 border-t border-glass-border/50 bg-bg-secondary/30">
                                      {answer.error ? (
                                        <div className="p-3 rounded-xs bg-error/10 text-error text-xs flex flex-col gap-2 mt-2">
                                          <div className="font-mono whitespace-pre-wrap">{answer.error}</div>
                                          {profile?.is_sa && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleRetrySingle(answer); }}
                                              disabled={retryingAnswerId === answer.id}
                                              className="btn btn-primary btn-sm mt-1 self-start"
                                            >
                                              <RefreshCw className={`w-3.5 h-3.5 ${retryingAnswerId === answer.id ? 'animate-spin' : ''}`} />
                                              {t('answers.retry')}
                                            </button>
                                          )}
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
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
