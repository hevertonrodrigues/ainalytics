import { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { APP_NAME, LOCALES } from '@/lib/constants';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

interface LandingHeaderProps {
  scrolled: boolean;
}

export function LandingHeader({ scrolled }: LandingHeaderProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const changeLang = useCallback(
    (lng: string) => {
      i18n.changeLanguage(lng);
      setMobileMenuOpen(false);
    },
    [i18n],
  );

  return (
    <nav className={`landing-nav${scrolled ? ' landing-nav-scrolled' : ''}`}>
      <div className="landing-container landing-nav-inner">
        <Link to="/" className="landing-logo" onClick={handleLogoClick}>
          <img src="/logo-purple.png" alt="Ainalytics" className="landing-logo-img" />
          <span>{APP_NAME}</span>
        </Link>

        {/* Desktop links */}
        <div className="landing-nav-links">
          <a href="#features">{t('landing.nav.features')}</a>
          <a href="#how-it-works">{t('landing.nav.howItWorks')}</a>
          <a href="#pricing">{t('landing.nav.pricing')}</a>
        </div>

        <div className="landing-nav-actions">
          {/* Lang switcher */}
          <div className="locale-switcher">
            {Object.values(LOCALES).map((lng) => (
              <button
                key={lng}
                className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                onClick={() => changeLang(lng)}
              >
                {LOCALE_LABELS[lng]}
              </button>
            ))}
          </div>
          <Link to="/signin" className="btn btn-ghost btn-sm">{t('landing.nav.signIn')}</Link>
          <Link to="/signup" className="btn btn-primary btn-sm">{t('landing.nav.getStarted')}</Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="landing-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="landing-mobile-menu">
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.features')}</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.howItWorks')}</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.pricing')}</a>
          <div className="landing-mobile-menu-divider" />
          <div className="locale-switcher" style={{ justifyContent: 'center' }}>
            {Object.values(LOCALES).map((lng) => (
              <button
                key={lng}
                className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                onClick={() => changeLang(lng)}
              >
                {LOCALE_LABELS[lng]}
              </button>
            ))}
          </div>
          <Link to="/signin" className="btn btn-ghost btn-sm w-full" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.signIn')}</Link>
          <Link to="/signup" className="btn btn-primary btn-sm w-full" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.getStarted')}</Link>
        </div>
      )}
    </nav>
  );
}
