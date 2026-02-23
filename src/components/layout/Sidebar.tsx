import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { APP_NAME } from '@/lib/constants';

const NAV_ITEMS = [
  { key: 'nav.dashboard', path: '/', icon: LayoutDashboard },
  { key: 'nav.profile', path: '/profile', icon: User },
  { key: 'nav.settings', path: '/settings', icon: Settings },
] as const;

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
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-bg-secondary/80 backdrop-blur-xl border-r border-glass-border flex flex-col z-40">
      {/* Brand */}
      <div className="p-6 border-b border-glass-border">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
          {APP_NAME}
        </h2>
      </div>

      {/* Tenant Switcher */}
      {tenants.length > 1 && (
        <div className="px-4 py-3 border-b border-glass-border">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider block mb-1.5">
            {t('tenant.current')}
          </label>
          <select
            value={currentTenant?.id || ''}
            onChange={(e) => switchTenant(e.target.value)}
            className="input-field text-sm py-2"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ key, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-primary/10 text-brand-secondary border border-brand-primary/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-glass-hover'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-glass-border">
        <button
          onClick={handleSignOut}
          className="btn btn-ghost w-full justify-start text-sm gap-3 text-text-muted hover:text-error"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('auth.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
