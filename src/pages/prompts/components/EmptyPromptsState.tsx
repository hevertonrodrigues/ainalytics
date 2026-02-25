import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function EmptyPromptsState() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="dashboard-card p-12 text-center">
      <p className="text-text-muted text-sm">{t('prompts.noPrompts')}</p>
      <button
        onClick={() => navigate('/dashboard/topics')}
        className="btn btn-primary btn-sm mt-4"
      >
        {t('topics.newTopic')}
      </button>
    </div>
  );
}
