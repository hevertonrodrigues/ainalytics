import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  MessageSquare,
  List,
  HelpCircle,
  Sun,
  Moon,
  User,
  ChevronUp,
  Cpu,
  Layers,
  CreditCard,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTheme } from '@/contexts/ThemeContext';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface NavItem {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { key: 'nav.overview', path: '/dashboard', icon: LayoutDashboard },
];

const ANALYTICS_NAV: NavItem[] = [
  { key: 'nav.topics', path: '/dashboard/topics', icon: MessageSquare },
  { key: 'nav.prompts', path: '/dashboard/prompts', icon: List },
  { key: 'nav.models', path: '/dashboard/models', icon: Layers },
];

const SA_PLATFORMS_NAV: NavItem = { key: 'nav.platforms', path: '/dashboard/platforms', icon: Cpu };

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { signOut, profile } = useAuth();
  const { currentTenant, tenants, switchTenant } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const hasPlan = !!currentTenant?.plan_id;

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  /** Render a nav item — disabled when no plan */
  const renderNavItem = ({ key, path, icon: Icon }: NavItem) => {
    if (!hasPlan) {
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

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary/80 backdrop-blur-xl border-r border-glass-border flex flex-col z-40 transition-colors duration-300">
      {/* Brand */}
      <div className="p-6 border-b border-glass-border">
        <div className="sidebar-brand">
          <img src="/logo-purple.png" alt="Ainalytics" className="sidebar-brand-logo" />
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            {APP_NAME}
          </h2>
        </div>
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

      {/* No-plan banner */}
      {!hasPlan && (
        <div className="mx-3 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-xs font-medium text-warning mb-1.5">{t('plans.noPlanTitle')}</p>
          <p className="text-xs text-text-secondary mb-2">{t('plans.noPlanDesc')}</p>
          <NavLink
            to="/dashboard/plans"
            className="btn btn-primary w-full text-xs py-1.5"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {t('plans.selectPlan')}
          </NavLink>
        </div>
      )}

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
          {profile?.is_sa && renderNavItem(SA_PLATFORMS_NAV)}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-glass-border">
        {/* Theme + Language row */}
        <div className="px-3 py-2.5 flex items-center justify-between">
          <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="locale-switcher">
            {Object.values(LOCALES).map((locale) => (
              <button
                key={locale}
                onClick={() => i18n.changeLanguage(locale)}
                className={`locale-btn${i18n.language === locale ? ' active' : ''}`}
              >
                {locale.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="px-3 pb-1">
          {hasPlan ? (
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
                <button className="sidebar-action">
                  <HelpCircle className="nav-link-icon" />
                  <span>{t('nav.support')}</span>
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
  );
}
