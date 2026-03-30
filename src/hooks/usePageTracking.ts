import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackPageExit } from '@/lib/analytics';

/**
 * Automatically tracks page views and time-on-page for every route change.
 * Should be placed once in a layout component (e.g. AppLayout).
 *
 * Fires:
 *   - page_view / entered  — on route entry
 *   - page_view / exited   — on route exit (with duration_ms)
 */
export function usePageTracking() {
  const { pathname } = useLocation();
  const enteredAt = useRef<number>(Date.now());
  const prevPathname = useRef<string>(pathname);

  useEffect(() => {
    const now = Date.now();

    // Fire exit event for the previous page (if pathname changed)
    if (prevPathname.current !== pathname) {
      const duration = now - enteredAt.current;
      trackPageExit(prevPathname.current, duration);
    }

    // Fire enter event for the new page
    trackPageView(pathname);
    enteredAt.current = now;
    prevPathname.current = pathname;

    // Fire exit on component unmount (user closes tab / navigates away)
    return () => {
      const exitDuration = Date.now() - enteredAt.current;
      trackPageExit(pathname, exitDuration);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
