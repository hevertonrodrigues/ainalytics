import * as Sentry from '@sentry/react';
import { SENTRY_DSN } from './constants';

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.globalHandlersIntegration({
        onerror: true,
        onunhandledrejection: true,
      }),
    ],
    enabled: import.meta.env.PROD,
    // Performance monitoring: sample 10% of transactions
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

export function setUserContext(userId: string, email?: string) {
  if (!SENTRY_DSN) return;
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}
