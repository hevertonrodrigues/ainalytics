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
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Prompt, Platform, PromptAnswer, Topic } from '@/types';

export function TopicAnswersPage() {
  const { id: topicId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { showToast } = useToast();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [answers, setAnswers] = useState<PromptAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchingPromptId, setSearchingPromptId] = useState<string | null>(null);
  const [retryingAnswerId, setRetryingAnswerId] = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [showPlatformConfig, setShowPlatformConfig] = useState(false);

  // Which platforms are selected for searching
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<Set<string>>(new Set());

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

      // Load active platforms
      const platformsRes = await apiClient.get<Platform[]>('/platforms');
      const activePlatforms = platformsRes.data.filter((p: Platform) => p.is_active);
      setPlatforms(activePlatforms);
      // Pre-select all active platforms
      setSelectedPlatformIds(new Set(activePlatforms.map((p: Platform) => p.id)));

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

  const selectedPlatforms = platforms.filter((p) => selectedPlatformIds.has(p.id));

  const handleSearch = async (prompt: Prompt) => {
    if (selectedPlatforms.length === 0) {
      setError(t('answers.noPlatformsEnabled'));
      return;
    }

    setSearchingPromptId(prompt.id);
    setError('');

    try {
      const res = await apiClient.post<PromptAnswer[]>('/prompt-search', {
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        platforms: selectedPlatforms.map((p) => ({
          slug: p.slug,
          model: p.default_model?.slug || p.slug,
          platform_id: p.id,
        })),
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

  // Retry a single failed answer
  const handleRetrySingle = async (answer: PromptAnswer) => {
    const prompt = prompts.find((p) => p.id === answer.prompt_id);
    if (!prompt) return;

    const platform = platforms.find((p) => p.slug === answer.platform_slug);
    if (!platform) return;

    setRetryingAnswerId(answer.id);
    setError('');

    try {
      const res = await apiClient.post<PromptAnswer[]>('/prompt-search', {
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        platforms: [{
          slug: platform.slug,
          model: platform.default_model?.slug || platform.slug,
          platform_id: platform.id,
        }],
      });

      // Replace the failed answer with the new one
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.id !== answer.id);
        return [...res.data, ...filtered];
      });
      showToast(t('answers.retryComplete'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      showToast(msg, 'error');
    } finally {
      setRetryingAnswerId(null);
    }
  };

  const togglePlatformSelection = (platformId: string) => {
    setSelectedPlatformIds((prev) => {
      const next = new Set(prev);
      if (next.has(platformId)) next.delete(platformId);
      else next.add(platformId);
      return next;
    });
  };

  const togglePromptExpand = (promptId: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(promptId)) next.delete(promptId);
      else next.add(promptId);
      return next;
    });
  };

  const getAnswersForPrompt = (promptId: string) =>
    answers.filter((a) => a.prompt_id === promptId);

  const getLatestAnswersForPrompt = (promptId: string) => {
    const all = getAnswersForPrompt(promptId);
    if (all.length === 0) return [];
    const latestDate = all[0]?.searched_at;
    return all.filter((a) => a.searched_at === latestDate);
  };

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
        <button onClick={() => navigate(`/topics/${topicId}`)} className="icon-btn">
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
        <button
          onClick={() => setShowPlatformConfig(!showPlatformConfig)}
          className="btn btn-ghost btn-sm"
        >
          <Cpu className="w-4 h-4" />
          {t('answers.platforms')} ({selectedPlatforms.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Platform Config Panel */}
      {showPlatformConfig && (
        <div className="dashboard-card p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            {t('answers.selectPlatforms')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => togglePlatformSelection(platform.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xs text-sm font-medium transition-colors ${
                  selectedPlatformIds.has(platform.id)
                    ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30'
                    : 'bg-bg-tertiary text-text-muted border border-glass-border hover:border-text-muted'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    PLATFORM_COLORS[platform.slug] || 'bg-gray-500'
                  }`}
                />
                {platform.name}
                {platform.default_model && (
                  <span className="text-[10px] opacity-60">({platform.default_model.name})</span>
                )}
              </button>
            ))}
          </div>
          {selectedPlatforms.length === 0 && (
            <p className="text-xs text-warning mt-2">{t('answers.noPlatformsEnabled')}</p>
          )}
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
            const promptAnswers = getLatestAnswersForPrompt(prompt.id);
            const allPromptAnswers = getAnswersForPrompt(prompt.id);
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

                  <button
                    onClick={() => handleSearch(prompt)}
                    disabled={isSearching || selectedPlatforms.length === 0}
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
                </div>

                {/* Expanded results */}
                {isExpanded && promptAnswers.length > 0 && (
                  <div className="border-t border-glass-border">
                    {promptAnswers.map((answer) => (
                      <div
                        key={answer.id}
                        className="p-4 border-b border-glass-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              PLATFORM_COLORS[answer.platform_slug] || 'bg-gray-500'
                            }`}
                          />
                          <span className="text-xs font-semibold text-text-primary uppercase">
                            {answer.platform_slug}
                          </span>
                          <span className="text-xs text-text-muted">{answer.model}</span>
                          {answer.latency_ms && (
                            <span className="text-xs text-text-muted ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {(answer.latency_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                          {answer.tokens_used && (
                            <span className="text-xs text-text-muted">
                              {answer.tokens_used.input + answer.tokens_used.output} tokens
                            </span>
                          )}
                        </div>

                        {answer.error ? (
                          <div className="p-2 rounded-xs bg-error/10 text-error text-xs flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0">{answer.error}</span>
                            <button
                              onClick={() => handleRetrySingle(answer)}
                              disabled={retryingAnswerId === answer.id}
                              className="btn btn-ghost btn-sm text-error shrink-0 gap-1"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${retryingAnswerId === answer.id ? 'animate-spin' : ''}`} />
                              {t('answers.retry')}
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {answer.answer_text}
                          </div>
                        )}
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
