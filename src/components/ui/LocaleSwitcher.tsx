import { useTranslation } from 'react-i18next';
import { LOCALES } from '@/lib/constants';

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className = '' }: LocaleSwitcherProps) {
  const { i18n } = useTranslation();

  const handleLocaleChange = (locale: string) => {
    i18n.changeLanguage(locale);
  };

  return (
    <div className={`locale-switcher ${className}`}>
      {Object.values(LOCALES).map((locale) => (
        <button
          key={locale}
          onClick={() => handleLocaleChange(locale)}
          className={`locale-btn${i18n.language === locale ? ' active' : ''}`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
