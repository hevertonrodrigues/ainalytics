import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Unified onboarding / setup gate.
 *
 * Decision matrix (evaluated top-to-bottom):
 *   • Still loading auth or tenant data → show spinner, NO redirect
 *   • Tenant has plan_id              → skip onboarding, proceed to company/models gates
 *   • No plan + has_seen_onboarding=F → redirect to /dashboard/onboarding
 *   • No plan + has_seen_onboarding=T → redirect to /dashboard/plans
 *
 * Pages like /dashboard/plans, /dashboard/profile, /dashboard/onboarding
 * are always reachable regardless of gate state.
 */
export function FlowGate() {
  const { currentTenant, hasCompany, hasModels, tenantLoading } = useTenant();
  const { profile, loading: authLoading, initialized } = useAuth();
  const { pathname } = useLocation();

  const hasPlan = !!currentTenant?.plan_id;
  const hasSeenOnboarding = !!profile?.has_seen_onboarding;

  // Paths always reachable regardless of gate state
  const alwaysAllowed = ['/dashboard/plans', '/dashboard/profile', '/dashboard/onboarding'];
  if (alwaysAllowed.some((p) => pathname.startsWith(p))) return <Outlet />;

  // ── Never redirect while data is still loading ──────────────
  if (!initialized || authLoading || tenantLoading) {
    return (
      <div className="stagger-enter space-y-6">
        <div className="dashboard-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
        </div>
      </div>
    );
  }

  // ── Gate 0: Plan check (takes priority over onboarding) ─────
  if (!hasPlan) {
    // No plan — check if user still needs to see onboarding
    if (!hasSeenOnboarding) return <Navigate to="/dashboard/onboarding" replace />;
    // Already saw onboarding but no plan yet → send to plans
    return <Navigate to="/dashboard/plans" replace />;
  }

  // ── From here on: tenant HAS a plan ─────────────────────────

  // Paths accessible after plan
  if (pathname.startsWith('/dashboard/company')) return <Outlet />;

  // Gate 1: Company
  if (!hasCompany) return <Navigate to="/dashboard/company" replace />;

  // Paths accessible after company
  if (pathname.startsWith('/dashboard/models')) return <Outlet />;

  // Gate 2: Models
  if (!hasModels) return <Navigate to="/dashboard/models" replace />;

  // All gates passed
  return <Outlet />;
}
