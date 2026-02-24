import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  MessageSquare,
  X,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { ActiveModelsGuard } from '@/components/guards/ActiveModelsGuard';
import type { Topic, CreateTopicInput, UpdateTopicInput } from '@/types';

type FormMode = 'closed' | 'create' | 'edit';

export function TopicsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">
          {t('topics.title')}
        </h1>
        {formMode === 'closed' && (
          <button onClick={openCreate} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            {t('topics.newTopic')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && formMode === 'closed' && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {formMode !== 'closed' && (
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="dashboard-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              {formMode === 'create' ? t('topics.newTopic') : t('topics.editTopic')}
            </h2>
            <button onClick={closeForm} type="button" className="icon-btn">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('topics.name')} *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('topics.namePlaceholder')}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('topics.description')}
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder={t('topics.descriptionPlaceholder')}
              className="input-field"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !formName.trim()}
              className="btn btn-primary btn-sm"
            >
              {saving ? t('common.loading') : formMode === 'create' ? t('common.create') : t('common.save')}
            </button>
            <button onClick={closeForm} type="button" className="btn btn-ghost btn-sm">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Topics List */}
      {topics.length === 0 && formMode === 'closed' ? (
        <div className="dashboard-card p-12 text-center">
          <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('topics.noTopics')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="dashboard-card p-4 flex items-center gap-4 group cursor-pointer"
              onClick={() => navigate(`/dashboard/topics/${topic.id}`)}
            >
              {/* Status dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  topic.is_active ? 'bg-success' : 'bg-text-muted'
                }`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {topic.name}
                  </span>
                  <span className="badge">
                    {topic.prompt_count || 0} {t('topics.promptCount').toLowerCase()}
                  </span>
                </div>
                {topic.description && (
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {topic.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div
                className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleToggleActive(topic)}
                  className={`text-xs px-2 py-1 rounded-xs font-medium transition-colors ${
                    topic.is_active
                      ? 'text-success bg-success/10 hover:bg-success/20'
                      : 'text-text-muted bg-bg-tertiary hover:bg-glass-hover'
                  }`}
                >
                  {topic.is_active ? t('topics.active') : t('topics.inactive')}
                </button>
                <button
                  onClick={() => openEdit(topic)}
                  className="icon-btn"
                  title={t('common.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(topic.id)}
                  className="icon-btn hover:!text-error"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chevron */}
              <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            </div>
          ))}
        </div>
      )}

      </div>
    </ActiveModelsGuard>
  );
}
