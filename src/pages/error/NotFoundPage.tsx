import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div>
          <h1 className="text-9xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-widest relative">
            <span className="opacity-20 blur-sm absolute inset-0 text-indigo-500">404</span>
            <span className="relative">404</span>
          </h1>
          <div className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-1 text-sm font-medium rounded shadow-sm rotate-12 absolute transform -translate-x-1/2 -translate-y-1/2 left-1/2 mt-[-60px]">
            {t('common.pageNotFound', 'Page Not Found')}
          </div>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('common.lost', 'Oops! Looks like you are lost.')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {t('common.lostDescription', "The page you're looking for doesn't exist or has been moved.")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500 transition-colors w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.goBack', 'Go Back')}
          </button>
          
          <Link 
            to="/dashboard"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors w-full sm:w-auto"
          >
            <Home className="w-4 h-4" />
            {t('common.backToHome', 'Back to Dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
