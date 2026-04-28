import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { resolvePostLoginRedirect } from '@/lib/redirect';
import type { ReactNode } from 'react';

interface GuestRouteProps {
  children: ReactNode;
}

/** Redirects authenticated users away from auth pages to the page they tried to access (or /dashboard). */
export function GuestRoute({ children }: GuestRouteProps) {
  const { profile, loading, initialized } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (profile) {
    return <Navigate to={resolvePostLoginRedirect(location.state)} replace />;
  }

  return <>{children}</>;
}
