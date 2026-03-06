import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ActiveModelsGuard } from '@/components/guards/ActiveModelsGuard';
import type { Prompt } from '@/types';

// Components
import { PromptsHeader } from './components/PromptsHeader';
import { EmptyPromptsState } from './components/EmptyPromptsState';
import { TopicPromptGroup } from './components/TopicPromptGroup';
import { PageExplanation } from '@/components/PageExplanation';
import type { TopicWithPrompts, FormMode } from '@/types/dashboard';

export function PromptsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<TopicWithPrompts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collapsed state per topic
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Form state
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formTopicId, setFormTopicId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const loadAll = useCallback(async () => {
    try {
      // Get all topics
      const topicsRes = await apiClient.get<TopicWithPrompts[]>('/topics-prompts');
      const topics = topicsRes.data;

      // Get prompts for each topic in parallel
      const withPrompts = await Promise.all(
        topics.map(async (topic) => {
          const promptsRes = await apiClient.get<Prompt[]>(
            `/topics-prompts/prompts?topicId=${topic.id}`,
          );
          return { ...topic, prompts_list: promptsRes.data };
        }),
      );

      setGroups(withPrompts);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleCollapsed = (topicId: string) => {
    setCollapsed((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const openCreate = (topicId: string) => {
    setFormMode('create');
    setFormTopicId(topicId);
    setEditingPrompt(null);
    setError('');
  };

  const openEdit = (prompt: Prompt) => {
    setFormMode('edit');
    setFormTopicId(prompt.topic_id);
    setEditingPrompt(prompt);
    setError('');
  };

  const closeForm = () => {
    setFormMode('closed');
    setFormTopicId(null);
    setEditingPrompt(null);
    setError('');
  };

  const handleFormSuccess = () => {
    closeForm();
    loadAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('prompts.confirmDelete'))) return;
    try {
      await apiClient.delete(`/topics-prompts/prompts?id=${id}`);
      showToast(t('prompts.deleted'));
      await loadAll();
    } catch {
      setError(t('common.error'));
    }
  };

  const handleToggleActive = async (prompt: Prompt) => {
    try {
      await apiClient.put('/topics-prompts/prompts', {
        id: prompt.id,
        is_active: !prompt.is_active,
      });
      await loadAll();
    } catch {
      setError(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="skeleton h-7 w-48" />
        {[1, 2].map((i) => (
          <div key={i} className="dashboard-card p-5">
            <div className="skeleton h-5 w-40 mb-3" />
            <div className="space-y-2 pl-4">
              <div className="skeleton h-4 w-64" />
              <div className="skeleton h-4 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const totalPrompts = groups.reduce((sum, g) => sum + g.prompts_list.length, 0);

  return (
    <ActiveModelsGuard>
      <div className="stagger-enter space-y-6 max-w-4xl">
        <PromptsHeader totalPrompts={totalPrompts} />

        {formMode === 'closed' && (
          <PageExplanation message={t('prompts.banner')} />
        )}

        {/* Error */}
        {error && formMode === 'closed' && (
          <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
            {error}
          </div>
        )}

        {/* List of Topic Groups */}
        {groups.length === 0 ? (
          <EmptyPromptsState />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <TopicPromptGroup
                key={group.id}
                group={group}
                isCollapsed={!!collapsed[group.id]}
                onToggleCollapse={toggleCollapsed}
                onOpenCreate={openCreate}
                onOpenEdit={openEdit}
                onDeletePrompt={handleDelete}
                onTogglePromptActive={handleToggleActive}
                formMode={formMode}
                formTopicId={formTopicId}
                editingPrompt={editingPrompt}
                onFormSuccess={handleFormSuccess}
                onFormCancel={closeForm}
              />
            ))}
          </div>
        )}
      </div>
    </ActiveModelsGuard>
  );
}
