import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { useAuth } from '@/contexts/AuthContext';
import { WelcomeModal } from '@/components/ui/WelcomeModal';
import { TutorialModal } from '@/components/ui/TutorialModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useLayout } from '@/contexts/LayoutContext';
import { useTranslation } from 'react-i18next';

export function AppLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [dismissedInSession, setDismissedInSession] = useState(false);
  const { activeTutorial, dismissTutorial } = useTutorial();
  const { setSidebarOpen } = useLayout();

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col lg:flex-row">
      <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
      
      <Sidebar />
      
      {/* Main content — offset by sidebar width on lg screens */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <main className="p-4 sm:p-6 flex-1">
          <Outlet />
        </main>
      </div>

      {profile && profile.has_seen_welcome_modal === false && !dismissedInSession && (
        <WelcomeModal onClose={() => setDismissedInSession(true)} />
      )}

      {activeTutorial && (profile?.has_seen_welcome_modal || dismissedInSession) && (
        <TutorialModal
          title={t(activeTutorial.title)}
          paragraphs={activeTutorial.paragraphs.map(p => t(p))}
          onClose={dismissTutorial}
        />
      )}
    </div>
  );
}
