import type { TFunction } from 'i18next';

/**
 * Map of Supabase auth error message patterns → i18n keys.
 * Each pattern is tested case-insensitively against the raw error message.
 */
const AUTH_ERROR_MAP: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /invalid login credentials/i, key: 'auth.errors.invalidCredentials' },
  { pattern: /email not confirmed/i, key: 'auth.errors.emailNotConfirmed' },
  { pattern: /user already registered/i, key: 'auth.errors.userAlreadyRegistered' },
  { pattern: /signup requires a valid password/i, key: 'auth.errors.invalidPassword' },
  { pattern: /unable to validate email address/i, key: 'auth.errors.invalidEmail' },
  { pattern: /email rate limit exceeded/i, key: 'auth.errors.rateLimitExceeded' },
  { pattern: /you can only request this after/i, key: 'auth.errors.tooManyRequests' },
  { pattern: /new password should be different/i, key: 'auth.errors.samePassword' },
  { pattern: /auth session missing/i, key: 'auth.errors.sessionExpired' },
];

/**
 * Given a caught error from Supabase auth, returns a user-friendly translated message.
 * Unknown errors include a "contact support" prompt with a link.
 */
export function getAuthErrorMessage(err: unknown, t: TFunction): string {
  const raw = err instanceof Error ? err.message : '';

  for (const { pattern, key } of AUTH_ERROR_MAP) {
    if (pattern.test(raw)) {
      return t(key);
    }
  }

  // Unknown / unexpected error → contact support
  return t('auth.errors.unknown');
}
