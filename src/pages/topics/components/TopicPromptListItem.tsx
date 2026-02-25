import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import type { Prompt } from '@/types';

interface TopicPromptListItemProps {
  prompt: Prompt;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onToggleActive: (prompt: Prompt) => void;
}

export function TopicPromptListItem({
  prompt,
  onEdit,
  onDelete,
  onToggleActive,
}: TopicPromptListItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
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
          onClick={() => onToggleActive(prompt)}
          className={`text-xs px-2 py-1 rounded-xs font-medium transition-colors ${
            prompt.is_active
              ? 'text-success bg-success/10 hover:bg-success/20'
              : 'text-text-muted bg-bg-tertiary hover:bg-glass-hover'
          }`}
        >
          {prompt.is_active ? t('prompts.active') : t('prompts.inactive')}
        </button>
        <button
          onClick={() => onEdit(prompt)}
          className="icon-btn"
          title={t('common.edit')}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(prompt.id)}
          className="icon-btn hover:!text-error"
          title={t('common.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
