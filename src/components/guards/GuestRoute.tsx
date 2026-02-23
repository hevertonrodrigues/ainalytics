import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

interface GuestRouteProps {
  children: ReactNode;
}

/** Redirects authenticated users away from auth pages to dashboard */
export function GuestRoute({ children }: GuestRouteProps) {
  const { profile, loading, initialized } = useAuth();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (profile) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
