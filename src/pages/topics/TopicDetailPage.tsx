import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { PromptForm } from '@/components/PromptForm';
import { ActiveModelsGuard } from '@/components/guards/ActiveModelsGuard';
import type { Topic, Prompt } from '@/types';

// Components
import { TopicDetailHeader } from './components/TopicDetailHeader';
import { TopicPromptListItem } from './components/TopicPromptListItem';
import { EmptyTopicsState as EmptyPromptsState } from './components/EmptyTopicsState';
import type { FormMode } from '@/types/dashboard';

export function TopicDetailPage() {
  const { t } = useTranslation();
  const { id: topicId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const loadData = useCallback(async () => {
    if (!topicId) return;
    try {
      const [topicsRes, promptsRes] = await Promise.all([
        apiClient.get<Topic[]>('/topics-prompts'),
        apiClient.get<Prompt[]>(`/topics-prompts/prompts?topicId=${topicId}`),
      ]);
      const found = topicsRes.data.find((t: Topic) => t.id === topicId);
      if (!found) {
        navigate('/dashboard/topics', { replace: true });
        return;
      }
      setTopic(found);
      setPrompts(promptsRes.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [topicId, t, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setFormMode('create');
    setEditingPrompt(null);
  };

  const openEdit = (prompt: Prompt) => {
    setFormMode('edit');
    setEditingPrompt(prompt);
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingPrompt(null);
    setError('');
  };

  const handleFormSuccess = () => {
    closeForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('prompts.confirmDelete'))) return;
    try {
      await apiClient.delete(`/topics-prompts/prompts?id=${id}`);
      showToast(t('prompts.deleted'));
      await loadData();
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
      await loadData();
    } catch {
      setError(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-7 w-56" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-card p-4">
              <div className="skeleton h-4 w-64 mb-1" />
              <div className="skeleton h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!topic) return null;

  return (
    <ActiveModelsGuard>
      <div className="stagger-enter space-y-6 max-w-4xl">
        <TopicDetailHeader
          topic={topic}
          topicId={topicId!}
          formMode={formMode}
          onOpenCreate={openCreate}
        />

        {/* Error */}
        {error && formMode === 'closed' && (
          <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {formMode !== 'closed' && (
          <PromptForm
            topicId={topicId!}
            prompt={editingPrompt}
            onSuccess={handleFormSuccess}
            onCancel={closeForm}
            variant="card"
          />
        )}

        {/* Prompts List */}
        {prompts.length === 0 && formMode === 'closed' ? (
          <EmptyPromptsState message={t('prompts.noPrompts')} />
        ) : (
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <TopicPromptListItem
                key={prompt.id}
                prompt={prompt}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        )}
      </div>
    </ActiveModelsGuard>
  );
}
