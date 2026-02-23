import { EDGE_FUNCTION_BASE, STORAGE_KEYS } from './constants';
import type { ApiResponse, ApiSuccessResponse } from '@/types';

/**
 * API client for calling Supabase Edge Functions.
 * All database mutations MUST go through this client.
 *
 * - Automatically attaches JWT from localStorage.
 * - Attaches x-tenant-id header for tenant context.
 * - Unwraps the standard response envelope.
 * - Throws on error responses.
 */

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const tenantId = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID);
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiSuccessResponse<T>> {
  const url = `${EDGE_FUNCTION_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
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
