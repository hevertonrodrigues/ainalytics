/**
 * Lightweight analytics helper that pushes events to:
 *  - Google Tag Manager dataLayer  (→ GA4)
 *  - Meta Pixel (fbq)
 *
 * Safe to call even when the pixel / GTM hasn't loaded yet.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    fbq?: (...args: unknown[]) => void;
  }
}

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
  // Skip all analytics in non-production environments
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

/* ── Pre-built helpers for common CTA events ── */

export function trackCTAClick(label: string, page?: string) {
  trackEvent({ event: 'cta_click', label, page });
}

export function trackBookCallClick(placement: string, page?: string) {
  trackEvent({
    event: 'book_call_click',
    label: `book_call_${placement}`,
    placement,
    page,
  });
}
