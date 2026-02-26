import { useTranslation } from 'react-i18next';
import { Search, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

export function Header() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-14 bg-bg-primary/60 backdrop-blur-xl border-b border-glass-border flex items-center justify-between px-6 transition-colors duration-300">
      <h1 className="text-lg font-semibold text-text-primary">
        {t('dashboard.title')}
      </h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder={t('common.search')}
            className="search-input"
          />
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="nav-link-icon" /> : <Moon className="nav-link-icon" />}
        </button>

        {/* Language Switcher */}
        <LocaleSwitcher />

        {/* User avatar */}
        {profile && (
          <div className="flex items-center gap-2.5 ml-1">
            <span className="text-sm text-text-secondary hidden sm:block">
              {profile.full_name}
            </span>
            <div className="user-avatar">
              {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
