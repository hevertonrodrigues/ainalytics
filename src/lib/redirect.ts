const DEFAULT_POST_LOGIN_PATH = '/dashboard';

interface FromLocation {
  pathname?: string;
  search?: string;
  hash?: string;
}

interface LocationStateLike {
  from?: FromLocation | string;
}

/**
 * Returns a safe in-app path to send the user to after login.
 *
 * Reads `state.from` (set by guards like SuperAdminRoute / ProtectedRoute when
 * they bounce an unauthenticated user to /signin) and rebuilds the original
 * pathname + search + hash. Falls back to /dashboard.
 *
 * Rejects anything that could lead off-site or back to an auth page:
 * absolute URLs, protocol-relative URLs (`//evil.com`), backslash tricks,
 * and the auth routes themselves (so refreshing /signin doesn't loop).
 */
export function resolvePostLoginRedirect(state: unknown): string {
  const from = (state as LocationStateLike | null)?.from;
  if (!from) return DEFAULT_POST_LOGIN_PATH;

  let pathname: string | undefined;
  let search = '';
  let hash = '';

  if (typeof from === 'string') {
    pathname = from;
  } else if (typeof from === 'object') {
    pathname = from.pathname;
    search = typeof from.search === 'string' ? from.search : '';
    hash = typeof from.hash === 'string' ? from.hash : '';
  }

  if (!pathname || typeof pathname !== 'string') return DEFAULT_POST_LOGIN_PATH;
  if (!pathname.startsWith('/')) return DEFAULT_POST_LOGIN_PATH;
  if (pathname.startsWith('//') || pathname.startsWith('/\\')) return DEFAULT_POST_LOGIN_PATH;

  const authRoutes = new Set(['/signin', '/signup', '/forgot-password', '/reset-password']);
  if (authRoutes.has(pathname)) return DEFAULT_POST_LOGIN_PATH;

  return `${pathname}${search}${hash}`;
}
