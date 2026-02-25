import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { FormMode } from '@/types/dashboard';

interface TopicsHeaderProps {
  formMode: FormMode;
  onOpenCreate: () => void;
}

export function TopicsHeader({ formMode, onOpenCreate }: TopicsHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold text-text-primary">
        {t('topics.title')}
      </h1>
      {formMode === 'closed' && (
        <button onClick={onOpenCreate} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          {t('topics.newTopic')}
        </button>
      )}
    </div>
  );
}
