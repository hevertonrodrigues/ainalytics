import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LogOut,
  Sun,
  Moon,
  Maximize,
  Minimize,
  ChevronUp,
  X,
  Shield,
  LayoutDashboard,
  Kanban,
  Activity,
  Package,
  Key,
  Globe,
  Cpu,
  DollarSign,
  BarChart3,
  Megaphone,
  Footprints,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLayout } from '@/contexts/LayoutContext';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { useScrollLock } from '@/hooks/useScrollLock';

interface NavItem {
  key: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SA_NAV: NavItem[] = [
  { key: 'sa.dashboard', path: '/sa', icon: LayoutDashboard },
  { key: 'sa.crmPipeline', path: '/sa/crm', icon: Kanban },
  { key: 'sa.activeUsers', path: '/sa/active', icon: Activity },
  { key: 'sa.analytics', path: '/sa/analytics', icon: Footprints },
  { key: 'sa.plansTitle', path: '/sa/plans', icon: Package },
  { key: 'sa.activationTitle', path: '/sa/activation-codes', icon: Key },
  { key: 'sa.platformsTitle', path: '/sa/platforms', icon: Globe },
  { key: 'sa.modelsTitle', path: '/sa/models', icon: Cpu },
  { key: 'sa.costs.title', path: '/sa/costs', icon: DollarSign },
  { key: 'sa.metaAds.title', path: '/sa/meta-ads', icon: Megaphone },
  { key: 'timeline.title', path: '/sa/monitoring', icon: BarChart3 },
  { key: 'sa.jobApps.title', path: '/sa/job-applications', icon: Briefcase },
];

export function SASidebar() {
  const { t } = useTranslation();
  const { signOut, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { layoutMode, toggleLayoutMode, isSidebarOpen, setSidebarOpen } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close sidebar drawer when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const renderNavItem = ({ key, path, icon: Icon }: NavItem) => {
    return (
      <NavLink
        key={path}
        to={path}
        end={path === '/sa'}
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      >
        <Icon className="nav-link-icon" />
        <span>{t(key)}</span>
      </NavLink>
    );
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
            <Shield className="w-6 h-6 text-brand-primary" />
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
              {t('sa.saAdmin')}
            </h2>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="section-label">{t('sa.management')}</div>
          <div className="space-y-0.5 mb-6">
            {SA_NAV.map(renderNavItem)}
          </div>

          <div className="section-label mt-4">{t('sa.tenantView')}</div>
          <div className="space-y-0.5">
             <NavLink
                to="/dashboard"
                className="nav-link text-text-muted hover:text-brand-primary group"
              >
                <LayoutDashboard className="nav-link-icon group-hover:text-brand-primary" />
                <span>{t('sa.backToDashboard')}</span>
              </NavLink>
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

          {/* User card with expandable sub-menu */}
          {profile && (
            <div className="border-t border-glass-border">
              {/* Sub-items */}
              {userMenuOpen && (
                <div className="px-3 pt-2 pb-1 space-y-0.5">
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
                  <div className="user-avatar shrink-0 border border-brand-primary/30">
                    <Shield className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary block truncate">
                      {profile.full_name}
                    </span>
                    <span className="text-xs text-brand-primary block truncate">
                      {t('sa.superAdminLabel')}
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
