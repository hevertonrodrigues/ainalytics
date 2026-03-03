import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Unified onboarding gate that guides users through a sequential setup:
 *   1. Plan  → redirect to /dashboard/plans
 *   2. Company → redirect to /dashboard/company
 *   3. Models  → redirect to /dashboard/models
 *
 * Pages for each step are placed OUTSIDE this gate in the routing tree,
 * so they remain accessible even when the gate is active.
 */
export function FlowGate() {
  const { currentTenant, hasCompany, hasModels } = useTenant();
  const { pathname } = useLocation();

  const hasPlan = !!currentTenant?.plan_id;

  // Paths always reachable regardless of gate state
  const alwaysAllowed = ['/dashboard/plans', '/dashboard/profile'];
  if (alwaysAllowed.some((p) => pathname.startsWith(p))) return <Outlet />;

  // Gate 1: Plan
  if (!hasPlan) return <Navigate to="/dashboard/plans" replace />;

  // Paths accessible after plan
  if (pathname.startsWith('/dashboard/company')) return <Outlet />;

  // Gate 2: Company
  if (!hasCompany) return <Navigate to="/dashboard/company" replace />;

  // Paths accessible after company
  if (pathname.startsWith('/dashboard/models')) return <Outlet />;

  // Gate 3: Models
  if (!hasModels) return <Navigate to="/dashboard/models" replace />;

  // All gates passed
  return <Outlet />;
}
