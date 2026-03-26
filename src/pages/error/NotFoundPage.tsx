import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft, Compass } from 'lucide-react';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="error-boundary-page">
      <div className="error-boundary-card">
        {/* Animated icon */}
        <div className="error-boundary-icon-wrapper">
          <div className="error-boundary-icon-glow" />
          <div className="error-boundary-icon-ring">
            <Compass className="error-boundary-icon error-boundary-icon-spin" />
          </div>
        </div>

        {/* Copy */}
        <div className="error-boundary-content">
          <h1 className="error-boundary-title">
            {t('errorPages.notFoundTitle', 'This Page Has Moved')}
          </h1>
          <p className="error-boundary-subtitle">
            {t('errorPages.notFoundSubtitle', "We may have reorganized things. Let's get you back on track.")}
          </p>
        </div>

        {/* Actions */}
        <div className="error-boundary-actions">
          <button
            onClick={() => window.history.back()}
            className="error-boundary-btn-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('errorPages.goBack', 'Go Back')}
          </button>
          
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="error-boundary-btn-primary"
          >
            <Home className="w-4 h-4" />
            {t('errorPages.goToDashboard', 'Go to Dashboard')}
          </button>
        </div>
      </div>
    </div>
  );
}
