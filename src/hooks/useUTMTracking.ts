import { useEffect } from 'react';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

/**
 * Hook to automatically capture and store UTM parameters and referrer
 * in sessionStorage for attribution tracking during signup.
 */
export function useUTMTracking() {
  useEffect(() => {
    // 1. Capture URL parameters
    const params = new URLSearchParams(window.location.search);
    let hasUtm = false;

    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) {
        sessionStorage.setItem(key, value);
        hasUtm = true;
      }
    }

    // Capture the original landing page if it's the first visit
    if (hasUtm && !sessionStorage.getItem('landing_page')) {
      sessionStorage.setItem('landing_page', window.location.href);
    }

    // 2. Capture HTTP Referrer
    // Only set if not already set, to avoid overwriting with internal navigation
    if (!sessionStorage.getItem('referrer') && document.referrer) {
      // Don't save our own site as referrer
      if (!document.referrer.includes(window.location.hostname)) {
        sessionStorage.setItem('referrer', document.referrer);
      }
    }
  }, []);
}
