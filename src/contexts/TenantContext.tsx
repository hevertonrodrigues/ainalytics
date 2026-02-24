import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuth } from './AuthContext';
import type { Tenant } from '@/types';

interface TenantContextValue {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  switchTenant: (tenantId: string) => void;
  updateTenantPlanId: (planId: string) => void;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenants: authTenants, refreshAuth } = useAuth();

  // Local overlay so we can patch plan_id without refetching
  const [planOverrides, setPlanOverrides] = useState<Record<string, string>>({});

  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID) || '';
  });

  // Apply any local plan_id overrides
  const tenants: Tenant[] = authTenants.map((t) => {
    const override = planOverrides[t.id];
    return override !== undefined ? { ...t, plan_id: override } : t;
  });

  const currentTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0] || null;

  const switchTenant = useCallback((tenantId: string) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, tenantId);
    setCurrentTenantId(tenantId);
  }, []);

  /** Update the current tenant's plan_id locally (after API call succeeds) */
  const updateTenantPlanId = useCallback(
    (planId: string) => {
      if (currentTenant) {
        setPlanOverrides((prev) => ({ ...prev, [currentTenant.id]: planId }));
      }
    },
    [currentTenant],
  );

  /** Refresh the current tenant from the database */
  const refreshTenant = useCallback(async () => {
    if (refreshAuth) {
      await refreshAuth();
    }
  }, [refreshAuth]);

  return (
    <TenantContext.Provider value={{ currentTenant, tenants, switchTenant, updateTenantPlanId, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
