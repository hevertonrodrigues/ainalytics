import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ChevronRight } from 'lucide-react';
import type { Topic } from '@/types';

interface TopicListItemProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (id: string) => void;
  onToggleActive: (topic: Topic) => void;
}

export function TopicListItem({
  topic,
  onEdit,
  onDelete,
  onToggleActive,
}: TopicListItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
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
        className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-wrap justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => onToggleActive(topic)}
          className={`text-xs px-2 py-1 rounded-xs font-medium transition-colors ${
            topic.is_active
              ? 'text-success bg-success/10 hover:bg-success/20'
              : 'text-text-muted bg-bg-tertiary hover:bg-glass-hover'
          }`}
        >
          {topic.is_active ? t('topics.active') : t('topics.inactive')}
        </button>
        <button
          onClick={() => onEdit(topic)}
          className="icon-btn"
          title={t('common.edit')}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(topic.id)}
          className="icon-btn hover:!text-error"
          title={t('common.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-text-muted shrink-0 hidden sm:block" />
    </div>
  );
}
