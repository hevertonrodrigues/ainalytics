import { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
  }

  public render() {
    if (this.state.hasError) {
      const { t } = this.props;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
              </div>
              
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t('common.somethingWentWrong', 'Something went wrong')}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('common.errorDescription', 'An unexpected error occurred. Our team has been notified.')}
                </p>
              </div>

              {import.meta.env.DEV && this.state.error && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto max-h-40 border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}

              <div className="flex flex-col space-y-3 pt-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800"
                >
                  <RefreshCcw className="w-4 h-4" />
                  {t('common.refreshPage', 'Refresh Page')}
                </button>
                
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700"
                >
                  <Home className="w-4 h-4" />
                  {t('common.backToHome', 'Back to Dashboard')}
                </button>
              </div>
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
