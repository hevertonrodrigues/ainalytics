import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  MessageSquare,
  AlertTriangle,
  BarChart3,
  List,
  HelpCircle,
  Sun,
  Moon,
  User,
  ChevronUp,
  Cpu,
  Layers,
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
  { key: 'nav.overview', path: '/', icon: LayoutDashboard },
];

const ANALYTICS_NAV: NavItem[] = [
  { key: 'nav.topics', path: '/topics', icon: MessageSquare },
  { key: 'nav.prompts', path: '/prompts', icon: List },
  { key: 'nav.platforms', path: '/platforms', icon: Cpu },
  { key: 'nav.models', path: '/models', icon: Layers },
  { key: 'nav.anomalies', path: '/anomalies', icon: AlertTriangle },
  { key: 'nav.reports', path: '/reports', icon: BarChart3 },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { signOut, profile } = useAuth();
  const { currentTenant, tenants, switchTenant } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary/80 backdrop-blur-xl border-r border-glass-border flex flex-col z-40 transition-colors duration-300">
      {/* Brand */}
      <div className="p-6 border-b border-glass-border">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
          {APP_NAME}
        </h2>
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

      {/* Navigation */}
      <nav className="flex-1 py-2 px-3 overflow-y-auto">
        {/* Main Section */}
        <div className="section-label">{t('nav.sectionMain')}</div>
        <div className="space-y-0.5">
          {MAIN_NAV.map(({ key, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-link-icon" />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </div>

        {/* Analytics Section */}
        <div className="section-label mt-4">{t('nav.sectionAnalytics')}</div>
        <div className="space-y-0.5">
          {ANALYTICS_NAV.map(({ key, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon className="nav-link-icon" />
              <span>{t(key)}</span>
            </NavLink>
          ))}
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
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Settings className="nav-link-icon" />
            <span>{t('nav.settings')}</span>
          </NavLink>
        </div>

        {/* User card with expandable sub-menu */}
        {profile && (
          <div className="border-t border-glass-border">
            {/* Sub-items (Profile, Support, Logout) */}
            {userMenuOpen && (
              <div className="px-3 pt-2 pb-1 space-y-0.5">
                <NavLink
                  to="/profile"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <User className="nav-link-icon" />
                  <span>{t('nav.profile')}</span>
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
