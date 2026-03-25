import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';

/**
 * Encapsulates the tenant setup-status checks (company + models).
 *
 * Fetches from the API on tenant change and exposes a `refreshSetup`
 * callback so any component can re-validate without relying on flags.
 */
export function useTenantSetup(tenantId: string | undefined) {
  const [hasCompany, setHasCompany] = useState(false);
  const [hasModels, setHasModels] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ref to the latest tenantId for use inside stable callbacks
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  /**
   * Fetch company + models existence from the API.
   * @param silent  When true, skips the loading spinner (used for background refreshes).
   */
  const fetchSetup = useCallback(async (silent = false) => {
    const id = tenantIdRef.current;
    if (!id) {
      setHasCompany(false);
      setHasModels(false);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);

    await Promise.all([
      apiClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .get<any>('/company')
        .then((res) => setHasCompany(!!res.data))
        .catch(() => setHasCompany(false)),
      apiClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .get<any[]>('/platforms/preferences')
        .then((res) => setHasModels(Array.isArray(res.data) && res.data.length > 0))
        .catch(() => setHasModels(false)),
    ]).finally(() => {
      if (!silent) setLoading(false);
    });
  }, []);

  // Fetch on tenant change (initial load + tenant switch)
  useEffect(() => {
    fetchSetup(false);
  }, [tenantId, fetchSetup]);

  /** Re-check company + models from the API without showing a loading spinner */
  const refreshSetup = useCallback(async () => {
    await fetchSetup(true);
  }, [fetchSetup]);

  return {
    hasCompany,
    setHasCompany,
    hasModels,
    loading,
    refreshSetup,
  };
}
