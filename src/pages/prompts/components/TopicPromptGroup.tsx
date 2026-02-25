import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Prompt } from '@/types';
import type { TopicWithPrompts, FormMode } from '@/types/dashboard';
import { PromptListItem } from './PromptListItem';
import { PromptForm } from '@/components/PromptForm';

interface TopicPromptGroupProps {
  group: TopicWithPrompts;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onOpenCreate: (id: string) => void;
  onOpenEdit: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  onTogglePromptActive: (prompt: Prompt) => void;
  formMode: FormMode;
  formTopicId: string | null;
  editingPrompt: Prompt | null;
  onFormSuccess: () => void;
  onFormCancel: () => void;
}

export function TopicPromptGroup({
  group,
  isCollapsed,
  onToggleCollapse,
  onOpenCreate,
  onOpenEdit,
  onDeletePrompt,
  onTogglePromptActive,
  formMode,
  formTopicId,
  editingPrompt,
  onFormSuccess,
  onFormCancel,
}: TopicPromptGroupProps) {
  const { t } = useTranslation();

  return (
    <div className="dashboard-card overflow-hidden">
      {/* Topic header */}
      <div
        onClick={() => onToggleCollapse(group.id)}
        className="w-full flex items-center gap-3 p-4 hover:bg-glass-hover transition-colors text-left cursor-pointer"
      >
        {isCollapsed ? (
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
            onOpenCreate(group.id);
          }}
          className="icon-btn"
          title={t('prompts.newPrompt')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Prompts list */}
      {!isCollapsed && (
        <div className="border-t border-glass-border">
          {group.prompts_list.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-text-muted mb-2">
                {t('prompts.noPrompts')}
              </p>
              <button
                onClick={() => onOpenCreate(group.id)}
                className="text-xs text-brand-primary hover:underline"
              >
                + {t('prompts.newPrompt')}
              </button>
            </div>
          ) : (
            group.prompts_list.map((prompt, idx) => (
              <PromptListItem
                key={prompt.id}
                prompt={prompt}
                isLast={idx === group.prompts_list.length - 1}
                onEdit={onOpenEdit}
                onDelete={onDeletePrompt}
                onToggleActive={onTogglePromptActive}
              />
            ))
          )}
        </div>
      )}

      {/* Inline form for this topic */}
      {formMode !== 'closed' && formTopicId === group.id && (
        <PromptForm
          topicId={group.id}
          prompt={editingPrompt}
          onSuccess={onFormSuccess}
          onCancel={onFormCancel}
          variant="inline"
        />
      )}
    </div>
  );
}
