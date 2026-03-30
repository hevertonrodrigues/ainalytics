import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { TutorialModal } from '@/components/ui/TutorialModal';
import { OverLimitToast } from '@/components/OverLimitToast';
import { useTutorial } from '@/hooks/useTutorial';
import { useLayout } from '@/contexts/LayoutContext';
import { usePageTracking } from '@/hooks/usePageTracking';
import { useTranslation } from 'react-i18next';

export function AppLayout() {
  const { t } = useTranslation();
  const { activeTutorial, dismissTutorial } = useTutorial();
  const { setSidebarOpen } = useLayout();
  const { pathname } = useLocation();

  // Track every page view and time-on-page across the dashboard
  usePageTracking();

  const isOnboarding = pathname.startsWith('/dashboard/onboarding');

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col lg:flex-row">
      {!isOnboarding && <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />}
      
      {!isOnboarding && <Sidebar />}
      
      {/* Main content — offset by sidebar width on lg screens (unless onboarding) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isOnboarding ? '' : 'lg:ml-64'}`}>
        <main className="p-4 sm:p-6 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Persistent over-limit toast — always visible for users exceeding plan */}
      {!isOnboarding && <OverLimitToast />}

      {activeTutorial && (
        <TutorialModal
          title={t(activeTutorial.title)}
          paragraphs={activeTutorial.paragraphs.map(p => t(p))}
          onClose={dismissTutorial}
        />
      )}
    </div>
  );
}
