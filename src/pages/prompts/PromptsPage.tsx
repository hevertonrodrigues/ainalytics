import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Topic, Prompt, CreatePromptInput, UpdatePromptInput } from '@/types';

type FormMode = 'closed' | 'create' | 'edit';

interface TopicWithPrompts extends Topic {
  prompts_list: Prompt[];
}

export function PromptsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<TopicWithPrompts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Collapsed state per topic
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Form state
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [formTopicId, setFormTopicId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formText, setFormText] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      // Get all topics
      const topicsRes = await apiClient.get<Topic[]>('/topics-prompts');
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
    setEditingId(null);
    setFormText('');
    setFormDesc('');
    setError('');
  };

  const openEdit = (prompt: Prompt) => {
    setFormMode('edit');
    setFormTopicId(prompt.topic_id);
    setEditingId(prompt.id);
    setFormText(prompt.text);
    setFormDesc(prompt.description || '');
    setError('');
  };

  const closeForm = () => {
    setFormMode('closed');
    setFormTopicId(null);
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
          topic_id: formTopicId!,
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
      await loadAll();
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
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">
            {t('prompts.title')}
          </h1>
          <span className="badge">{totalPrompts}</span>
        </div>
      </div>

      {/* Error */}
      {error && formMode === 'closed' && (
        <div className="p-3 rounded-xs bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 ? (
        <div className="dashboard-card p-12 text-center">
          <p className="text-text-muted text-sm">{t('prompts.noPrompts')}</p>
          <button
            onClick={() => navigate('/topics')}
            className="btn btn-primary btn-sm mt-4"
          >
            {t('topics.newTopic')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="dashboard-card overflow-hidden">
              {/* Topic header */}
              <button
                onClick={() => toggleCollapsed(group.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-glass-hover transition-colors text-left"
              >
                {collapsed[group.id] ? (
                  <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                )}
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    group.is_active ? 'bg-success' : 'bg-text-muted'
                  }`}
                />
                <span className="text-sm font-semibold text-text-primary flex-1">
                  {group.name}
                </span>
                <span className="badge">
                  {group.prompts_list.length} {t('topics.promptCount').toLowerCase()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate(group.id);
                  }}
                  className="icon-btn"
                  title={t('prompts.newPrompt')}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </button>

              {/* Prompts list */}
              {!collapsed[group.id] && (
                <div className="border-t border-glass-border">
                  {group.prompts_list.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-text-muted mb-2">
                        {t('prompts.noPrompts')}
                      </p>
                      <button
                        onClick={() => openCreate(group.id)}
                        className="text-xs text-brand-primary hover:underline"
                      >
                        + {t('prompts.newPrompt')}
                      </button>
                    </div>
                  ) : (
                    group.prompts_list.map((prompt, idx) => (
                      <div
                        key={prompt.id}
                        className={`flex items-center gap-3 px-4 py-3 group ${
                          idx < group.prompts_list.length - 1
                            ? 'border-b border-glass-border/50'
                            : ''
                        }`}
                      >
                        {/* Indent + dot */}
                        <div className="w-4" />
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            prompt.is_active ? 'bg-success' : 'bg-text-muted'
                          }`}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-text-primary block truncate">
                            {prompt.text}
                          </span>
                          {prompt.description && (
                            <p className="text-xs text-text-muted truncate">
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
                    ))
                  )}
                </div>
              )}

              {/* Inline form for this topic */}
              {formMode !== 'closed' && formTopicId === group.id && (
                <div className="border-t border-glass-border p-4 space-y-3 bg-bg-tertiary/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-secondary">
                      {formMode === 'create' ? t('prompts.newPrompt') : t('prompts.editPrompt')}
                    </h3>
                    <button onClick={closeForm} className="icon-btn">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {error && (
                    <div className="p-2 rounded-xs bg-error/10 border border-error/20 text-error text-xs">
                      {error}
                    </div>
                  )}

                  <input
                    type="text"
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    placeholder={t('prompts.textPlaceholder')}
                    className="input-field text-sm"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder={t('prompts.descriptionPlaceholder')}
                    className="input-field text-sm"
                  />
                  <div className="flex items-center gap-2">
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
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
