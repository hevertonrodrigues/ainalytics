import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LOCALES } from '@/lib/constants';

export function Header() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const handleLocaleChange = (locale: string) => {
    i18n.changeLanguage(locale);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-bg-primary/60 backdrop-blur-xl border-b border-glass-border flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <div className="flex items-center gap-1 bg-glass-bg rounded-lg p-1">
          {Object.values(LOCALES).map((locale) => (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                i18n.language === locale
                  ? 'bg-brand-primary/20 text-brand-secondary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>

        {/* User avatar */}
        {profile && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary hidden sm:block">
              {profile.full_name}
            </span>
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center text-sm font-semibold text-brand-secondary">
              {profile.full_name?.charAt(0)?.toUpperCase() || t('common.loading').charAt(0)}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
