import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';

interface EmptyTopicsStateProps {
  message?: string;
}

export function EmptyTopicsState({ message }: EmptyTopicsStateProps) {
  const { t } = useTranslation();

  return (
    <div className="dashboard-card p-12 text-center">
      <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
      <p className="text-text-muted text-sm">{message || t('topics.noTopics')}</p>
    </div>
  );
}
