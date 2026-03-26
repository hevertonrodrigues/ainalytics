import { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, Home, Wrench } from 'lucide-react';
import { captureException } from '@/lib/sentry';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ErrorBoundaryClass extends Component<Props & { t: any }, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    captureException(error, { componentStack: errorInfo.componentStack });
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props;
      
      return (
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            {/* Animated icon */}
            <div className="error-boundary-icon-wrapper">
              <div className="error-boundary-icon-glow" />
              <div className="error-boundary-icon-ring">
                <Wrench className="error-boundary-icon" />
              </div>
            </div>

            {/* Copy */}
            <div className="error-boundary-content">
              <h1 className="error-boundary-title">
                {t('errorPages.maintenanceTitle', "We're improving things for you")}
              </h1>
              <p className="error-boundary-subtitle">
                {t('errorPages.maintenanceSubtitle', 'Our team is working on updates to make your experience even better. This usually takes just a moment.')}
              </p>
            </div>

            {/* Actions */}
            <div className="error-boundary-actions">
              <button
                onClick={() => window.location.reload()}
                className="error-boundary-btn-primary"
              >
                <RefreshCcw className="w-4 h-4" />
                {t('errorPages.tryAgain', 'Try Again')}
              </button>
              
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="error-boundary-btn-secondary"
              >
                <Home className="w-4 h-4" />
                {t('errorPages.goToDashboard', 'Go to Dashboard')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper to inject `t` from useTranslation hook since it can't be used inside a Class component directly
export function ErrorBoundary({ children }: Props) {
  const { t } = useTranslation();
  return <ErrorBoundaryClass t={t}>{children}</ErrorBoundaryClass>;
}
