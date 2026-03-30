/**
 * Analytics helper — dual-track:
 *  1. Internal tracking  → our own user_activity_log (via track-activity edge function)
 *  2. External tracking  → Google Tag Manager / Meta Pixel (production only)
 *
 * Safe to call even when the pixel / GTM hasn't loaded yet.
 */

import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY, STORAGE_KEYS } from './constants';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (...args: unknown[]) => void;
  }
}

// ────────────────────────────────────────────────────────────
// Session Management (anonymous tracking)
// ────────────────────────────────────────────────────────────

const SESSION_KEY = 'ainalytics_session_id';

/** Get or create a persistent anonymous session ID */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// ────────────────────────────────────────────────────────────
// Internal Tracking (our own database)
// ────────────────────────────────────────────────────────────

export interface ActivityEvent {
  event_type: string;
  event_action: string;
  event_target?: string;
  metadata?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
}

/**
 * Fire-and-forget event to our internal user_activity_log.
 * Works for both anonymous and authenticated users.
 * Never throws — silently catches all errors.
 */
export function trackActivity(event: ActivityEvent): void {
  try {
    const url = `${EDGE_FUNCTION_BASE}/track-activity`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    };

    // Attach auth token if available
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach tenant ID if available
    const tenantId = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }

    const body = {
      ...event,
      session_id: getSessionId(),
      page_url: event.page_url || window.location.href,
      referrer: event.referrer || document.referrer || undefined,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    };

    // Use sendBeacon for reliability on page unload, fallback to fetch
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    const beaconUrl = `${url}?apikey=${SUPABASE_ANON_KEY}`;

    if (navigator.sendBeacon) {
      // sendBeacon doesn't support custom headers, so use fetch for auth'd requests
      if (token) {
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {});
      } else {
        // For anonymous users, sendBeacon is more reliable on page unload
        if (!navigator.sendBeacon(beaconUrl, blob)) {
          // Fallback if sendBeacon fails
          fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            keepalive: true,
          }).catch(() => {});
        }
      }
    } else {
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never throw — tracking should never break the app
  }
}

// ────────────────────────────────────────────────────────────
// External Tracking (GTM / Meta Pixel) — production only
// ────────────────────────────────────────────────────────────

interface TrackEventParams {
  /** GTM/GA4 event name, e.g. 'cta_click' */
  event: string;
  /** Descriptive label identifying the button */
  label: string;
  /** Page where the event happened */
  page?: string;
  /** Extra key–value pairs */
  [key: string]: unknown;
}

export function trackEvent({ event, label, page, ...extra }: TrackEventParams) {
  // Skip GTM/Pixel in non-production environments
  if (!import.meta.env.PROD) return;

  const payload = {
    event,
    event_label: label,
    page: page ?? window.location.pathname,
    ...extra,
  };

  // GTM / GA4
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  // Meta Pixel — fire a custom event
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', event, { label, page: payload.page, ...extra });
  }
}

// ────────────────────────────────────────────────────────────
// Pre-built Helpers
// ────────────────────────────────────────────────────────────

export function trackCTAClick(label: string, page?: string) {
  trackEvent({ event: 'cta_click', label, page });
  trackActivity({
    event_type: 'cta_click',
    event_action: 'clicked',
    event_target: label,
  });
}

export function trackBookCallClick(placement: string, page?: string) {
  trackEvent({
    event: 'book_call_click',
    label: `book_call_${placement}`,
    placement,
    page,
  });
  trackActivity({
    event_type: 'book_call_click',
    event_action: 'clicked',
    event_target: placement,
  });
}

/** Track a page view (called by usePageTracking hook) */
export function trackPageView(pathname: string) {
  trackActivity({
    event_type: 'page_view',
    event_action: 'entered',
    event_target: pathname,
  });
}

/** Track a page exit with duration */
export function trackPageExit(pathname: string, durationMs: number) {
  trackActivity({
    event_type: 'page_view',
    event_action: 'exited',
    event_target: pathname,
    metadata: { duration_ms: durationMs },
  });
}
