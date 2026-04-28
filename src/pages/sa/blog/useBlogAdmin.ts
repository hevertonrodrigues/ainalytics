import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

type Entity =
  | 'languages' | 'locale_meta' | 'authors' | 'categories' | 'tags' | 'brands'
  | 'articles' | 'ticker' | 'rankings' | 'rankings_items' | 'ranking_faq'
  | 'newsletter';

function buildPath(entity: Entity, qs?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams({ entity });
  if (qs) for (const [k, v] of Object.entries(qs)) {
    if (v !== undefined && v !== null && String(v).length > 0) params.set(k, String(v));
  }
  return `/blog-admin?${params.toString()}`;
}

/**
 * Generic CRUD hook for the blog-admin Edge Function.
 * Supports list-mode (auto-fetch) and explicit `fetchOne(id)` for detail views.
 */
export function useBlogAdmin<T extends { id?: string | number }>(
  entity: Entity,
  options: { initialFetch?: boolean; query?: Record<string, string | number | undefined> } = {},
) {
  const { initialFetch = true, query } = options;
  const queryKey = JSON.stringify(query || {});
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(initialFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<T[]>(buildPath(entity, JSON.parse(queryKey)));
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [entity, queryKey]);

  useEffect(() => {
    if (initialFetch) fetchAll();
  }, [initialFetch, fetchAll]);

  const fetchOne = useCallback(async (id: string | number): Promise<T | null> => {
    try {
      const res = await apiClient.get<T>(buildPath(entity, { id: String(id) }));
      return res.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [entity]);

  const create = useCallback(async (body: unknown): Promise<T> => {
    const res = await apiClient.post<T>(buildPath(entity), body);
    setData((prev) => [res.data, ...prev]);
    return res.data;
  }, [entity]);

  const update = useCallback(async (id: string | number, body: unknown): Promise<T> => {
    const res = await apiClient.put<T>(buildPath(entity, { id: String(id) }), body);
    setData((prev) => prev.map((item) => String(item.id) === String(id) ? res.data : item));
    return res.data;
  }, [entity]);

  const remove = useCallback(async (id: string | number): Promise<void> => {
    await apiClient.delete(buildPath(entity, { id: String(id) }));
    setData((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }, [entity]);

  return { data, isLoading, error, refetch: fetchAll, fetchOne, create, update, remove };
}

export const blogAdmin = {
  // For one-off calls without using the hook
  list: <T>(entity: Entity, query?: Record<string, string | number | undefined>) =>
    apiClient.get<T[]>(buildPath(entity, query)),
  one: <T>(entity: Entity, id: string | number) =>
    apiClient.get<T>(buildPath(entity, { id: String(id) })),
  create: <T>(entity: Entity, body: unknown) =>
    apiClient.post<T>(buildPath(entity), body),
  update: <T>(entity: Entity, id: string | number, body: unknown) =>
    apiClient.put<T>(buildPath(entity, { id: String(id) }), body),
  remove: (entity: Entity, id: string | number) =>
    apiClient.delete(buildPath(entity, { id: String(id) })),
  // Direct path call (for special routes like /blog-admin/articles/:id/publish)
  call: <T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => {
    const fullPath = path.startsWith('/') ? path : `/${path}`;
    if (method === 'GET') return apiClient.get<T>(fullPath);
    if (method === 'POST') return apiClient.post<T>(fullPath, body);
    if (method === 'PUT') return apiClient.put<T>(fullPath, body);
    return apiClient.delete<T>(fullPath);
  },
};
