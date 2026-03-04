import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuth } from './AuthContext';
import { apiClient } from '@/lib/api';
import type { Tenant } from '@/types';

interface TenantContextValue {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  /** Whether the current tenant has a linked company */
  hasCompany: boolean;
  setHasCompany: (v: boolean) => void;
  /** Whether the tenant has at least one active model preference */
  hasModels: boolean;
  setHasModels: (v: boolean) => void;
  /** True when plan + company + models are all set up */
  isFullySetup: boolean;
  /** True while tenant-related data (company, models) is being fetched */
  tenantLoading: boolean;
  switchTenant: (tenantId: string) => void;
  updateTenantPlanId: (planId: string) => void;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenants: authTenants, refreshAuth } = useAuth();

  const [planOverrides, setPlanOverrides] = useState<Record<string, string>>({});
  const [hasCompany, setHasCompany] = useState(false);
  const [hasModels, setHasModels] = useState(false);
  const [tenantLoading, setTenantLoading] = useState(true);

  const [currentTenantId, setCurrentTenantId] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID) || '',
  );

  const tenants: Tenant[] = authTenants.map((t) => {
    const override = planOverrides[t.id];
    return override !== undefined ? { ...t, plan_id: override } : t;
  });

  const currentTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0] || null;
  const hasPlan = !!currentTenant?.plan_id;
  const isFullySetup = hasPlan && hasCompany && hasModels;

  // Fetch company + models existence when tenant changes
  useEffect(() => {
    if (!currentTenant?.id) {
      setHasCompany(false);
      setHasModels(false);
      setTenantLoading(false);
      return;
    }
    let cancelled = false;
    setTenantLoading(true);

    // Fetch company and models in parallel, then mark loading done
    Promise.all([
      apiClient
        .get<any>('/company')
        .then((res) => { if (!cancelled) setHasCompany(!!res.data); })
        .catch(() => { if (!cancelled) setHasCompany(false); }),
      apiClient
        .get<any[]>('/platforms/preferences')
        .then((res) => { if (!cancelled) setHasModels(Array.isArray(res.data) && res.data.length > 0); })
        .catch(() => { if (!cancelled) setHasModels(false); }),
    ]).finally(() => {
      if (!cancelled) setTenantLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  const switchTenant = useCallback((tenantId: string) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, tenantId);
    setCurrentTenantId(tenantId);
  }, []);

  const updateTenantPlanId = useCallback(
    (planId: string) => {
      if (currentTenant) {
        setPlanOverrides((prev) => ({ ...prev, [currentTenant.id]: planId }));
      }
    },
    [currentTenant],
  );

  const refreshTenant = useCallback(async () => {
    if (refreshAuth) await refreshAuth();
  }, [refreshAuth]);

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        hasCompany,
        setHasCompany,
        hasModels,
        setHasModels,
        isFullySetup,
        tenantLoading,
        switchTenant,
        updateTenantPlanId,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
