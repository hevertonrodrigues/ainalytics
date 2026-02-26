import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ActiveModelsGuard } from '@/components/guards/ActiveModelsGuard';
import type { Topic, CreateTopicInput, UpdateTopicInput } from '@/types';

// Components
import { TopicsHeader } from './components/TopicsHeader';
import { TopicForm } from './components/TopicForm';
import { TopicListItem } from './components/TopicListItem';
import { EmptyTopicsState } from './components/EmptyTopicsState';
import { PageExplanation } from '@/components/PageExplanation';
import type { FormMode } from '@/types/dashboard';

export function TopicsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTopics = useCallback(async () => {
    try {
      const res = await apiClient.get<Topic[]>('/topics-prompts');
      setTopics(res.data);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setFormName('');
    setFormDesc('');
  };

  const openEdit = (topic: Topic) => {
    setFormMode('edit');
    setEditingId(topic.id);
    setFormName(topic.name);
    setFormDesc(topic.description || '');
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError('');

    try {
      if (formMode === 'create') {
        const input: CreateTopicInput = {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        };
        await apiClient.post('/topics-prompts', input);
        showToast(t('topics.created'));
      } else {
        const input: UpdateTopicInput = {
          id: editingId!,
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        };
        await apiClient.put('/topics-prompts', input);
        showToast(t('topics.updated'));
      }
      closeForm();
      await loadTopics();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('topics.confirmDelete'))) return;
    try {
      await apiClient.delete(`/topics-prompts?id=${id}`);
      showToast(t('topics.deleted'));
      await loadTopics();
    } catch {
      setError(t('common.error'));
    }
  };

  const handleToggleActive = async (topic: Topic) => {
    try {
      await apiClient.put('/topics-prompts', {
        id: topic.id,
        is_active: !topic.is_active,
      });
      await loadTopics();
    } catch {
      setError(t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dashboard-card p-5">
              <div className="skeleton h-5 w-40 mb-2" />
              <div className="skeleton h-3 w-64" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ActiveModelsGuard>
      <div className="stagger-enter space-y-6 max-w-4xl">
        <TopicsHeader formMode={formMode} onOpenCreate={openCreate} />
        
        {formMode === 'closed' && (
          <PageExplanation 
            message={t('topics.banner')} 
            pageName={t('nav.topics')}
          />
        )}

        {/* Error */}
        {error && formMode === 'closed' && (
          <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {formMode !== 'closed' && (
          <TopicForm
            formMode={formMode}
            onClose={closeForm}
            error={error}
            formName={formName}
            setFormName={setFormName}
            formDesc={formDesc}
            setFormDesc={setFormDesc}
            saving={saving}
            onSubmit={handleSubmit}
          />
        )}

        {/* Topics List */}
        {topics.length === 0 && formMode === 'closed' ? (
          <EmptyTopicsState />
        ) : (
          <div className="space-y-2">
            {topics.map((topic) => (
              <TopicListItem
                key={topic.id}
                topic={topic}
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
