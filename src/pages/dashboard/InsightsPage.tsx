import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';

export function InsightsPage() {
  const { t } = useTranslation();

  return (
    <div className="stagger-enter space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {t('nav.insights')}
        </h1>
      </div>

      <div className="dashboard-card p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
          <Lightbulb className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t('dashboard.processingResultsTitle')}
        </h2>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          {t('dashboard.processingResultsDesc')}
        </p>
      </div>
    </div>
  );
}
