import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  FileSearch,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { APP_NAME } from '@/lib/constants';
import { SearchSelect } from '@/components/ui/SearchSelect';

interface NavItem {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { key: 'nav.overview', path: '/', icon: LayoutDashboard },
  { key: 'nav.profile', path: '/profile', icon: User },
  { key: 'nav.settings', path: '/settings', icon: Settings },
];

const ANALYTICS_NAV: NavItem[] = [
  { key: 'nav.trends', path: '/trends', icon: TrendingUp },
  { key: 'nav.anomalies', path: '/anomalies', icon: AlertTriangle },
  { key: 'nav.reports', path: '/reports', icon: BarChart3 },
  { key: 'nav.documents', path: '/documents', icon: FileSearch },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { currentTenant, tenants, switchTenant } = useTenant();
  const navigate = useNavigate();

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

      {/* Bottom actions */}
      <div className="p-3 border-t border-glass-border space-y-0.5">
        <button className="sidebar-action">
          <HelpCircle className="nav-link-icon" />
          <span>{t('nav.support')}</span>
        </button>
        <button onClick={handleSignOut} className="sidebar-action sidebar-action-danger">
          <LogOut className="nav-link-icon" />
          <span>{t('auth.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
