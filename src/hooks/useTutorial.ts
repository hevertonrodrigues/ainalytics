import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

/**
 * Maps URL paths to tutorial translation keys
 */
const PATH_MAP: Record<string, string> = {
  '/dashboard/topics': 'topics',
  '/dashboard/prompts': 'prompts',
  '/dashboard/sources': 'sources',
  '/dashboard/llmtext': 'llmText',
  '/dashboard/insights': 'insights',
  '/dashboard/models': 'models',
  '/dashboard/platforms': 'models',
  '/dashboard/analyses': 'insights',
};

export function useTutorial() {
  const { pathname } = useLocation();
  const { profile, refreshAuth } = useAuth();
  const [activeTutorial, setActiveTutorial] = useState<{ key: string; title: string; paragraphs: string[] } | null>(null);

  useEffect(() => {
    if (!profile) return;

    // Determine the tutorial key for the current path
    const pageKey = PATH_MAP[pathname];
    if (!pageKey) {
      setActiveTutorial(null);
      return;
    }

    // Check if user has already seen this tutorial
    const views = (profile.tutorial_views as Record<string, boolean>) || {};
    if (views[pageKey]) {
      setActiveTutorial(null);
      return;
    }

    // Prepare tutorial content (will be retrieved via translations in the component)
    // We just return the key here, and the component handles t()
    setActiveTutorial({
      key: pageKey,
      title: `tutorials.${pageKey}.title`,
      paragraphs: [
        `tutorials.${pageKey}.p1`,
        `tutorials.${pageKey}.p2`,
        `tutorials.${pageKey}.p3`,
      ],
    });
  }, [pathname, profile]);

  const dismissTutorial = async () => {
    if (!activeTutorial || !profile) return;

    const pageKey = activeTutorial.key;
    const currentViews = (profile.tutorial_views as Record<string, boolean>) || {};
    
    try {
      // Update local state first for responsiveness
      setActiveTutorial(null);

      // Save to database
      await apiClient.put('/users-me', {
        tutorial_views: {
          ...currentViews,
          [pageKey]: true,
        },
      });
      
      // Refresh auth to get updated profile
      await refreshAuth();
    } catch (err) {
      console.error('Failed to dismiss tutorial', err);
    }
  };

  return {
    activeTutorial,
    dismissTutorial,
  };
}
