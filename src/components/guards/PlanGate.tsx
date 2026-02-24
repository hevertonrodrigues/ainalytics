import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

/**
 * Gate that locks the user to /dashboard/plans (and /dashboard/profile for
 * convenience) when the current tenant has no active plan.
 *
 * Wrap the dashboard <Route> children inside this gate so that every
 * sub-route is protected. The plans page itself is rendered normally.
 */
export function PlanGate() {
  const { currentTenant } = useTenant();
  const { pathname } = useLocation();

  const hasPlan = !!currentTenant?.plan_id;

  // Always allow access to the plans page and profile
  const allowedPaths = ['/dashboard/plans', '/dashboard/profile'];
  const isAllowed = allowedPaths.some((p) => pathname.startsWith(p));

  if (!hasPlan && !isAllowed) {
    return <Navigate to="/dashboard/plans" replace />;
  }

  return <Outlet />;
}
