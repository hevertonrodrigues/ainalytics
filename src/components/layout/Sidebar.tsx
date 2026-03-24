import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  MessageSquare,
  List,
  BarChart3,
  HelpCircle,
  Sun,
  Moon,
  Maximize,
  Minimize,
  User,
  BookOpen,
  ChevronUp,
  Cpu,
  Layers,
  CreditCard,
  Lock,
  FileText,
  Building2,
  X,
  Radar,
  Microscope,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { APP_NAME } from '@/lib/constants';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { useScrollLock } from '@/hooks/useScrollLock';

interface NavItem {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true, this item is always enabled when plan is active (not blocked by company/models gates) */
  alwaysEnabled?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { key: 'nav.overview', path: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.monitorCompany', path: '/dashboard/company', icon: Radar, alwaysEnabled: true },
];

const ANALYTICS_NAV: NavItem[] = [
  { key: 'nav.topics', path: '/dashboard/topics', icon: MessageSquare },
  { key: 'nav.prompts', path: '/dashboard/prompts', icon: List },
  { key: 'nav.insights', path: '/dashboard/insights', icon: Sun },
  { key: 'nav.analyses', path: '/dashboard/analyses', icon: BarChart3 },
  { key: 'nav.sources', path: '/dashboard/sources', icon: BookOpen },
  { key: 'nav.llmText', path: '/dashboard/llmtext', icon: FileText },
  { key: 'nav.models', path: '/dashboard/models', icon: Layers, alwaysEnabled: true },
];

const SA_DEEP_ANALYZE_NAV: NavItem = { key: 'nav.deepAnalyze', path: '/dashboard/deep-analyze', icon: Microscope };
const SA_PLATFORMS_NAV: NavItem = { key: 'nav.platforms', path: '/dashboard/platforms', icon: Cpu };

export function Sidebar() {
  const { t } = useTranslation();
  const { signOut, profile } = useAuth();
  const { currentTenant, tenants, switchTenant, hasCompany, hasModels, isFullySetup } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const { layoutMode, toggleLayoutMode, isSidebarOpen, setSidebarOpen } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close sidebar drawer when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const hasPlan = !!currentTenant?.active_plan_id;

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  /** Render a nav item — disabled when flow gates are incomplete */
  const renderNavItem = ({ key, path, icon: Icon, alwaysEnabled }: NavItem) => {
    const isEnabled = !hasPlan ? false : alwaysEnabled ? true : isFullySetup;

    if (!isEnabled) {
      return (
        <span key={path} className="nav-link nav-link-disabled">
          <Icon className="nav-link-icon" />
          <span>{t(key)}</span>
          <Lock className="w-3 h-3 ml-auto text-text-muted" />
        </span>
      );
    }
    return (
      <NavLink
        key={path}
        to={path}
        end={path === '/dashboard'}
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      >
        <Icon className="nav-link-icon" />
        <span>{t(key)}</span>
      </NavLink>
    );
  };

  /** Determine which setup step banner to show */
  const renderSetupBanner = () => {
    if (!hasPlan) {
      return (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-xs font-medium text-warning mb-1.5">{t('plans.noPlanTitle')}</p>
          <p className="text-xs text-text-secondary mb-2">{t('plans.noPlanDesc')}</p>
          <NavLink to="/dashboard/plans" className="btn btn-primary w-full text-xs py-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            {t('plans.selectPlan')}
          </NavLink>
        </div>
      );
    }
    if (!hasCompany) {
      return (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-brand-primary/10 border border-brand-primary/20">
          <p className="text-xs font-medium text-brand-primary mb-1.5">{t('flow.noCompanyTitle')}</p>
          <p className="text-xs text-text-secondary mb-2">{t('flow.noCompanyDesc')}</p>
          <NavLink to="/dashboard/company" className="btn btn-primary w-full text-xs py-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {t('flow.noCompanyAction')}
          </NavLink>
        </div>
      );
    }
    if (!hasModels) {
      return (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-brand-accent/10 border border-brand-accent/20">
          <p className="text-xs font-medium text-brand-accent mb-1.5">{t('flow.noModelsTitle')}</p>
          <p className="text-xs text-text-secondary mb-2">{t('flow.noModelsDesc')}</p>
          <NavLink to="/dashboard/models" className="btn btn-primary w-full text-xs py-1.5">
            <Layers className="w-3.5 h-3.5" />
            {t('flow.noModelsAction')}
          </NavLink>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isSidebarOpen && <MobileBackdrop onClose={() => setSidebarOpen(false)} />}

      <aside className={`fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary/80 backdrop-blur-xl border-r border-glass-border flex flex-col z-50 transition-all duration-300 transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand */}
        <div className="p-6 border-b border-glass-border flex items-center justify-between">
          <div 
            className="sidebar-brand cursor-pointer" 
            onClick={() => navigate('/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/')}
          >
            <img src="/logo-purple.png" alt="Ainalytics" className="sidebar-brand-logo" />
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              {APP_NAME}
            </h2>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Tenant Switcher */}
      {tenants.length > 1 && (
        <div className="px-4 py-3 border-b border-glass-border">
          <label className="kpi-label block mb-1.5">{t('tenant.current')}</label>
          <SearchSelect
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
            value={currentTenant?.id || ''}
            onChange={(val) => switchTenant(val)}
            placeholder={t('tenant.current')}
          />
        </div>
      )}

      {/* Setup step banner */}
      {renderSetupBanner()}

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3 overflow-y-auto">
        {/* Main Section */}
        <div className="section-label">{t('nav.sectionMain')}</div>
        <div className="space-y-0.5">
          {MAIN_NAV.map(renderNavItem)}
        </div>

        {/* Analytics Section */}
        <div className="section-label mt-4">{t('nav.sectionAnalytics')}</div>
        <div className="space-y-0.5">
          {ANALYTICS_NAV.map(renderNavItem)}
          {profile?.is_sa && renderNavItem(SA_DEEP_ANALYZE_NAV)}
          {profile?.is_sa && renderNavItem(SA_PLATFORMS_NAV)}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-glass-border">
        {/* Theme + Layout + Language row */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={toggleLayoutMode} className="icon-btn" aria-label="Toggle layout">
              {layoutMode === 'expanded' ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
          <LocaleSwitcher />
        </div>

        {/* Settings */}
        <div className="px-3 pb-1">
          {isFullySetup ? (
            <NavLink
              to="/dashboard/settings"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Settings className="nav-link-icon" />
              <span>{t('nav.settings')}</span>
            </NavLink>
          ) : (
            <span className="nav-link nav-link-disabled">
              <Settings className="nav-link-icon" />
              <span>{t('nav.settings')}</span>
              <Lock className="w-3 h-3 ml-auto text-text-muted" />
            </span>
          )}
        </div>

        {/* User card with expandable sub-menu */}
        {profile && (
          <div className="border-t border-glass-border">
            {/* Sub-items (Profile, Support, Logout) */}
            {userMenuOpen && (
              <div className="px-3 pt-2 pb-1 space-y-0.5">
                <NavLink
                  to="/dashboard/profile"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <User className="nav-link-icon" />
                  <span>{t('nav.profile')}</span>
                </NavLink>
                <NavLink
                  to="/dashboard/plans"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <CreditCard className="nav-link-icon" />
                  <span>{t('nav.plans')}</span>
                </NavLink>
                <NavLink
                  to="/dashboard/support"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <HelpCircle className="nav-link-icon" />
                  <span>{t('nav.support')}</span>
                </NavLink>
                {/* TODO: Remove after Sentry test */}
                <button
                  onClick={() => { throw new Error('This is your first error!'); }}
                  className="sidebar-action sidebar-action-danger"
                >
                  <span className="nav-link-icon">🔥</span>
                  <span>Sentry Test</span>
                </button>
                <button onClick={handleSignOut} className="sidebar-action sidebar-action-danger">
                  <LogOut className="nav-link-icon" />
                  <span>{t('auth.signOut')}</span>
                </button>
              </div>
            )}

            {/* User card trigger */}
            <div className="px-3 py-3">
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xs hover:bg-glass-hover transition-colors text-left"
              >
                <div className="user-avatar shrink-0">
                  {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary block truncate">
                    {profile.full_name}
                  </span>
                  <span className="text-xs text-text-muted block truncate">
                    {profile.email}
                  </span>
                </div>
                <ChevronUp
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                    userMenuOpen ? '' : 'rotate-180'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
      </aside>
    </>
  );
}

function MobileBackdrop({ onClose }: { onClose: () => void }) {
  useScrollLock();
  return (
    <div 
      className="fixed inset-0 bg-bg-primary/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
      onClick={onClose}
    />
  );
}
