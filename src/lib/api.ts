import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY, STORAGE_KEYS } from './constants';
import type { ApiResponse, ApiSuccessResponse } from '@/types';
import { supabase } from './supabase';

/**
 * API client for calling Supabase Edge Functions.
 * All database mutations MUST go through this client.
 *
 * - Automatically attaches JWT from localStorage.
 * - Attaches x-tenant-id header for tenant context.
 * - Unwraps the standard response envelope.
 * - Throws on error responses.
 */

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };

  // 1. Try to get a fresh token from the Supabase session (handles auto-refresh)
  // This is safe to call before every request because the GoTrue client caches
  // the session in memory and only does a network request if the token is expired.
  const { data: sessionData } = await supabase.auth.getSession();
  
  let token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

  if (sessionData.session?.access_token) {
    token = sessionData.session.access_token;
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    if (sessionData.session.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, sessionData.session.refresh_token);
    }
  }

  headers['Authorization'] = `Bearer ${token || SUPABASE_ANON_KEY}`;

  const tenantId = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID);
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}

async function handleUnauthorized(): Promise<string | null> {
  // If we got a 401, force a session refresh
  const { data, error } = await supabase.auth.refreshSession();
  
  if (error || !data.session) {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    window.location.href = '/signin';
    return null;
  }
  
  const newToken = data.session.access_token;
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);
  if (data.session.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.session.refresh_token);
  }
  return newToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false
): Promise<ApiSuccessResponse<T>> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBase = EDGE_FUNCTION_BASE.endsWith('/') 
    ? EDGE_FUNCTION_BASE.slice(0, -1) 
    : EDGE_FUNCTION_BASE;
  const url = `${cleanBase}${cleanPath}`;

  const res = await fetch(url, {
    method,
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    // Retry once on 401 with refreshed token
    if (res.status === 401 && !isRetry) {
      const newToken = await handleUnauthorized();
      if (newToken) {
        return request<T>(method, path, body, true);
      }
    }
    
    const msg = json.error?.message || 'Unknown error';
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }

  return json;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
