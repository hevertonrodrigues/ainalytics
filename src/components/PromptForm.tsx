import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import type { Prompt, CreatePromptInput, UpdatePromptInput } from '@/types';

const PROMPT_MAX_LENGTH = 500;

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

export interface PromptFormProps {
  /** Topic to create a prompt under (create mode) */
  topicId: string;
  /** Prompt to edit — when set the form enters edit mode */
  prompt?: Prompt | null;
  /** Called after a successful create or update */
  onSuccess: () => void;
  /** Called when the user cancels / closes the form */
  onCancel: () => void;
  /**
   * Visual variant:
   * - `"card"` – dashboard-card with labels (TopicDetailPage)
   * - `"inline"` – compact inline form (PromptsPage)
   */
  variant?: 'card' | 'inline';
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function PromptForm({
  topicId,
  prompt,
  onSuccess,
  onCancel,
  variant = 'card',
}: PromptFormProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const isEdit = !!prompt;

  const [text, setText] = useState(prompt?.text ?? '');
  const [desc, setDesc] = useState(prompt?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = text.trim().length > 0 && text.trim().length <= PROMPT_MAX_LENGTH && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    try {
      if (isEdit) {
        const input: UpdatePromptInput = {
          id: prompt!.id,
          text: text.trim(),
          description: desc.trim() || undefined,
        };
        await apiClient.put('/topics-prompts/prompts', input);
        showToast(t('prompts.updated'));
      } else {
        const input: CreatePromptInput = {
          topic_id: topicId,
          text: text.trim(),
          description: desc.trim() || undefined,
        };
        await apiClient.post('/topics-prompts/prompts', input);
        showToast(t('prompts.created'));
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Inline variant (PromptsPage) ──────────────────────────
  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="border-t border-glass-border p-4 space-y-3 bg-bg-tertiary/30">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary">
            {isEdit ? t('prompts.editPrompt') : t('prompts.newPrompt')}
          </h3>
          <button onClick={onCancel} type="button" className="icon-btn">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <div className="p-2 rounded-xs bg-error/10 border border-error/20 text-error text-xs">
            {error}
          </div>
        )}

        <div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('prompts.textPlaceholder')}
            maxLength={PROMPT_MAX_LENGTH}
            className="input-field text-sm"
            autoFocus
          />
          <div className={`flex justify-end mt-1 text-xs ${
            text.length >= PROMPT_MAX_LENGTH
              ? 'text-error'
              : text.length >= PROMPT_MAX_LENGTH * 0.9
                ? 'text-warning'
                : 'text-text-muted'
          }`}>
            {t('prompts.charCount', { count: text.length, max: PROMPT_MAX_LENGTH })}
          </div>
        </div>

        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('prompts.descriptionPlaceholder')}
          className="input-field text-sm"
        />

        <div className="flex items-center gap-2">
          <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-sm">
            {saving ? t('common.loading') : isEdit ? t('common.save') : t('common.create')}
          </button>
          <button onClick={onCancel} type="button" className="btn btn-ghost btn-sm">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    );
  }

  // ── Card variant (TopicDetailPage) ────────────────────────
  return (
    <form onSubmit={handleSubmit} className="dashboard-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          {isEdit ? t('prompts.editPrompt') : t('prompts.newPrompt')}
        </h2>
        <button onClick={onCancel} type="button" className="icon-btn">
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('prompts.textPlaceholder')}
          maxLength={PROMPT_MAX_LENGTH}
          className="input-field"
          autoFocus
        />
        <div className={`flex justify-end mt-1 text-xs ${
          text.length >= PROMPT_MAX_LENGTH
            ? 'text-error'
            : text.length >= PROMPT_MAX_LENGTH * 0.9
              ? 'text-warning'
              : 'text-text-muted'
        }`}>
          {t('prompts.charCount', { count: text.length, max: PROMPT_MAX_LENGTH })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t('prompts.description')}
        </label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('prompts.descriptionPlaceholder')}
          className="input-field"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-sm">
          {saving ? t('common.loading') : isEdit ? t('common.save') : t('common.create')}
        </button>
        <button onClick={onCancel} type="button" className="btn btn-ghost btn-sm">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
