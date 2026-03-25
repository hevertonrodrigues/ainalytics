import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

interface SuperAdminRouteProps {
  children: ReactNode;
}

/**
 * Top-level route guard for /sa
 * Redirects to /signin if not logged in.
 * Redirects to /dashboard if logged in but not a super admin.
 */
export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { profile, loading, initialized } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!profile) {
    // Redirect unauthenticated users to login, save where they tried to go
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (!profile.is_sa) {
    // Redirect authenticated non-SA users to the regular dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
