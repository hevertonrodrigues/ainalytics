import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Database } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Prompt, PromptAnswer, Topic, TenantPlatformModel } from '@/types';

// Components
import { PromptHeader } from './components/PromptHeader';
import { BackgroundFetchNotice } from './components/BackgroundFetchNotice';
import { SourcesSummaryTable } from './components/SourcesSummaryTable';
import { PlatformAnswerGroup } from './components/PlatformAnswerGroup';
import type { PlatformGroup, PromptSource } from '@/types/dashboard';

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
  const [promptSources, setPromptSources] = useState<PromptSource[]>([]);
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

      // 3. Fetch and aggregate sources
      const { data: sourcesData, error: sourcesErr } = await supabase
        .from('prompt_answer_sources')
        .select(`
          url,
          title,
          source:sources(domain, name),
          answer:prompt_answers(platform_slug)
        `)
        .eq('prompt_id', promptId);

      if (sourcesErr) {
        console.error('Error fetching sources:', sourcesErr);
      }

      if (sourcesData) {
        const aggregated = new Map<string, PromptSource>();
        for (const item of (sourcesData as any[])) {
          const domain = item.source?.domain || 'Unknown';
          const name = item.source?.name || null;
          const platform = item.answer?.platform_slug || 'AI';

          if (!aggregated.has(domain)) {
            aggregated.set(domain, {
              domain,
              name,
              total_count: 0,
              platforms: {}
            });
          }
          const entry = aggregated.get(domain)!;
          entry.total_count++;
          entry.platforms[platform] = (entry.platforms[platform] || 0) + 1;
        }
        setPromptSources(
          Array.from(aggregated.values()).sort((a, b) => b.total_count - a.total_count)
        );
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
      <PromptHeader
        prompt={prompt}
        topic={topic}
        profile={profile}
        searching={searching}
        tenantModels={tenantModels}
        answers={answers}
        error={error}
        onBack={() => navigate('/dashboard/prompts')}
        onSearch={handleSearch}
      />

      <BackgroundFetchNotice profile={profile} answersCount={answers.length} />

      {!error && (
        <SourcesSummaryTable sources={promptSources} />
      )}

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
            {groupedAnswers.map((group) => (
              <PlatformAnswerGroup
                key={group.platform_slug}
                group={group}
                profile={profile}
                isExpanded={expandedPlatforms.has(group.platform_slug)}
                onToggle={() => togglePlatform(group.platform_slug)}
                expandedAnswers={expandedAnswers}
                onToggleAnswer={toggleAnswerExpand}
                onRetryAnswer={handleRetrySingle}
                retryingAnswerId={retryingAnswerId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
