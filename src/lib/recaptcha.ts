/**
 * Google reCAPTCHA v3 — Frontend utility.
 * Lazily loads the script on first use and provides a simple execute API.
 */

import { RECAPTCHA_SITE_KEY } from '@/lib/constants';

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Already loaded (e.g. script tag in HTML)
    if (window.grecaptcha) {
      window.grecaptcha.ready(resolve);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      window.grecaptcha.ready(resolve);
    };
    script.onerror = () => {
      loadPromise = null; // allow retry
      reject(new Error('Failed to load reCAPTCHA script'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Execute reCAPTCHA v3 and return a token for the given action.
 * Returns `null` if reCAPTCHA is not configured (missing site key).
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('[recaptcha] VITE_RECAPTCHA_SITE_KEY not set — skipping');
    return null;
  }

  await loadScript();
  return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
}

export function isLocalhostBrowser(): boolean {
  return typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
}

export function executeRecaptchaForPublicAction(action: string): Promise<string | null> {
  return isLocalhostBrowser() ? Promise.resolve(null) : executeRecaptcha(action);
}
