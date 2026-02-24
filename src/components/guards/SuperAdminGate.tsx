import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Gate that restricts access to SuperAdmin-only routes.
 * Users without is_sa = true are redirected to the dashboard.
 */
export function SuperAdminGate() {
  const { profile } = useAuth();

  if (!profile?.is_sa) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
