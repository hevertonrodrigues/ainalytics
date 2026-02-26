import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { WelcomeModal } from '@/components/ui/WelcomeModal';
import { TutorialModal } from '@/components/ui/TutorialModal';
import { useTutorial } from '@/hooks/useTutorial';
import { useTranslation } from 'react-i18next';

export function AppLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [dismissedInSession, setDismissedInSession] = useState(false);
  const { activeTutorial, dismissTutorial } = useTutorial();

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      {/* Main content — offset by sidebar width (w-64 = 16rem) */}
      <div style={{ marginLeft: '16rem' }}>
        <main className="p-6">
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
