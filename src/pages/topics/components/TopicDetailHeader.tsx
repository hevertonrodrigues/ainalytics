import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus } from 'lucide-react';
import type { Topic } from '@/types';
import { FormMode } from '../prompts-types';

interface TopicDetailHeaderProps {
  topic: Topic;
  topicId: string;
  formMode: FormMode;
  onOpenCreate: () => void;
}

export function TopicDetailHeader({
  topic,
  topicId,
  formMode,
  onOpenCreate,
}: TopicDetailHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
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
            <button onClick={onOpenCreate} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              {t('prompts.newPrompt')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
