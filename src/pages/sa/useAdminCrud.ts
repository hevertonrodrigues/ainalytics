import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

type Entity = 'plans' | 'activation_codes' | 'platforms' | 'models';

export function useAdminCrud<T extends { id: string }>(entity: Entity) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<T[]>(`/admin-settings?entity=${entity}`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [entity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const create = async (body: Partial<T>) => {
    const res = await apiClient.post<T>(`/admin-settings?entity=${entity}`, body);
    setData(prev => [res.data, ...prev]);
    return res.data;
  };

  const update = async (id: string, body: Partial<T>) => {
    const res = await apiClient.put<T>(`/admin-settings?entity=${entity}&id=${id}`, body);
    setData(prev => prev.map(item => item.id === id ? res.data : item));
    return res.data;
  };

  const remove = async (id: string) => {
    await apiClient.delete(`/admin-settings?entity=${entity}&id=${id}`);
    setData(prev => prev.filter(item => item.id !== id));
  };

  return { data, isLoading, error, refetch: fetchData, create, update, remove };
}
