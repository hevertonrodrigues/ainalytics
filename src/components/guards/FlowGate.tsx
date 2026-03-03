import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Unified onboarding gate that guides users through a sequential setup:
 *   0. Onboarding → redirect to /dashboard/onboarding
 *   1. Plan    → redirect to /dashboard/plans
 *   2. Company → redirect to /dashboard/company
 *   3. Models  → redirect to /dashboard/models
 *
 * Pages for each step are placed OUTSIDE this gate in the routing tree,
 * so they remain accessible even when the gate is active.
 */
export function FlowGate() {
  const { currentTenant, hasCompany, hasModels } = useTenant();
  const { profile } = useAuth();
  const { pathname } = useLocation();

  const hasPlan = !!currentTenant?.plan_id;
  const hasSeenOnboarding = !!profile?.has_seen_onboarding;

  // Paths always reachable regardless of gate state
  const alwaysAllowed = ['/dashboard/plans', '/dashboard/profile', '/dashboard/onboarding'];
  if (alwaysAllowed.some((p) => pathname.startsWith(p))) return <Outlet />;

  // Gate 0: Onboarding
  if (!hasSeenOnboarding) return <Navigate to="/dashboard/onboarding" replace />;

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
