import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuth } from './AuthContext';
import { useTenantSetup } from '@/hooks/useTenantSetup';
import type { Tenant } from '@/types';

interface TenantContextValue {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  /** Whether the current tenant has a linked company */
  hasCompany: boolean;
  setHasCompany: (v: boolean) => void;
  /** Whether the tenant has at least one active model preference */
  hasModels: boolean;
  /** True when plan + company + models are all set up */
  isFullySetup: boolean;
  /** True while tenant-related data (company, models) is being fetched */
  tenantLoading: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenant: () => Promise<void>;
  /** Re-fetch company + models setup status from the API */
  refreshSetup: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { tenants: authTenants, refreshAuth } = useAuth();

  const [currentTenantId, setCurrentTenantId] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID) || '',
  );

  const tenants: Tenant[] = authTenants;
  const currentTenant = tenants.find((t) => t.id === currentTenantId) || tenants[0] || null;
  const hasPlan = !!currentTenant?.active_plan_id;

  // Delegate setup checks to the dedicated hook
  const { hasCompany, setHasCompany, hasModels, loading: tenantLoading, refreshSetup } =
    useTenantSetup(currentTenant?.id);

  const isFullySetup = hasPlan && hasCompany && hasModels;

  const switchTenant = useCallback((tenantId: string) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TENANT_ID, tenantId);
    setCurrentTenantId(tenantId);
  }, []);

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
        isFullySetup,
        tenantLoading,
        switchTenant,
        refreshTenant,
        refreshSetup,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

