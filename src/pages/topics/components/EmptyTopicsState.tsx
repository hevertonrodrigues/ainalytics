import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';

export function EmptyTopicsState() {
  const { t } = useTranslation();

  return (
    <div className="dashboard-card p-12 text-center">
      <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
      <p className="text-text-muted text-sm">{t('topics.noTopics')}</p>
    </div>
  );
}
