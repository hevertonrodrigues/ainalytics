import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  X,
  MessageSquare,
  Search,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Topic, Prompt, CreatePromptInput, UpdatePromptInput } from '@/types';

type FormMode = 'closed' | 'create' | 'edit';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formText, setFormText] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!topicId) return;
    try {
      // Load topic info and prompts in parallel
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
    setEditingId(null);
    setFormText('');
    setFormDesc('');
  };

  const openEdit = (prompt: Prompt) => {
    setFormMode('edit');
    setEditingId(prompt.id);
    setFormText(prompt.text);
    setFormDesc(prompt.description || '');
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingId(null);
    setFormText('');
    setFormDesc('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!formText.trim()) return;
    setSaving(true);
    setError('');

    try {
      if (formMode === 'create') {
        const input: CreatePromptInput = {
          topic_id: topicId!,
          text: formText.trim(),
          description: formDesc.trim() || undefined,
        };
        await apiClient.post('/topics-prompts/prompts', input);
        showToast(t('prompts.created'));
      } else {
        const input: UpdatePromptInput = {
          id: editingId!,
          text: formText.trim(),
          description: formDesc.trim() || undefined,
        };
        await apiClient.put('/topics-prompts/prompts', input);
        showToast(t('prompts.updated'));
      }
      closeForm();
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSaving(false);
    }
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
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard/topics')}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('prompts.backToTopics')}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{topic.name}</h1>
            {topic.description && (
              <p className="text-sm text-text-muted mt-0.5">{topic.description}</p>
            )}
          </div>
          {formMode === 'closed' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/dashboard/topics/${topicId}/answers`)}
                className="btn btn-ghost btn-sm"
              >
                <Search className="w-4 h-4" />
                {t('answers.title')}
              </button>
              <button onClick={openCreate} className="btn btn-primary btn-sm">
                <Plus className="w-4 h-4" />
                {t('prompts.newPrompt')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && formMode === 'closed' && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {formMode !== 'closed' && (
        <div className="dashboard-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              {formMode === 'create' ? t('prompts.newPrompt') : t('prompts.editPrompt')}
            </h2>
            <button onClick={closeForm} className="icon-btn">
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
              {t('prompts.text')} *
            </label>
            <input
              type="text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder={t('prompts.textPlaceholder')}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('prompts.description')}
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder={t('prompts.descriptionPlaceholder')}
              className="input-field"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={saving || !formText.trim()}
              className="btn btn-primary btn-sm"
            >
              {saving ? t('common.loading') : formMode === 'create' ? t('common.create') : t('common.save')}
            </button>
            <button onClick={closeForm} className="btn btn-ghost btn-sm">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Prompts List */}
      {prompts.length === 0 && formMode === 'closed' ? (
        <div className="dashboard-card p-12 text-center">
          <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('prompts.noPrompts')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="dashboard-card p-4 flex items-center gap-4 group"
            >
              {/* Status dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  prompt.is_active ? 'bg-success' : 'bg-text-muted'
                }`}
              />

              {/* Content */}
              <div
                className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/dashboard/prompts/${prompt.id}`)}
              >
                <span className="text-sm font-medium text-text-primary block truncate hover:underline">
                  {prompt.text}
                </span>
                {prompt.description && (
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {prompt.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggleActive(prompt)}
                  className={`text-xs px-2 py-1 rounded-xs font-medium transition-colors ${
                    prompt.is_active
                      ? 'text-success bg-success/10 hover:bg-success/20'
                      : 'text-text-muted bg-bg-tertiary hover:bg-glass-hover'
                  }`}
                >
                  {prompt.is_active ? t('prompts.active') : t('prompts.inactive')}
                </button>
                <button
                  onClick={() => openEdit(prompt)}
                  className="icon-btn"
                  title={t('common.edit')}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  className="icon-btn hover:!text-error"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
