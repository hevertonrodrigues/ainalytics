import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { APP_NAME, LOCALES, STORAGE_KEYS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };
const SUPPORTED_LANG_CODES: Set<string> = new Set(Object.values(LOCALES));

interface LandingHeaderProps {
  scrolled: boolean;
}

export function LandingHeader({ scrolled }: LandingHeaderProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  // Check if user is logged in (lightweight — no AuthProvider needed)
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || '';
    supabase.auth.setSession({ access_token: token, refresh_token: refreshToken }).then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name as string | undefined;
        setUserName(name?.split(' ')[0] || name || session.user.email?.split('@')[0] || null);
      }
    }).catch(() => {
      // Token invalid or expired — treat as logged out
    });
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const changeLang = useCallback(
    (lng: string) => {
      i18n.changeLanguage(lng);
      // Update URL to reflect the chosen language
      const pathSegment = location.pathname.split('/')[1]?.toLowerCase();
      if (pathSegment && SUPPORTED_LANG_CODES.has(pathSegment as typeof lng)) {
        // Already on a /:lang route — replace it
        navigate(`/${lng}`, { replace: true });
      } else if (location.pathname === '/') {
        // On root landing — navigate to /:lang
        navigate(`/${lng}`, { replace: true });
      }
      setMobileMenuOpen(false);
    },
    [i18n, location.pathname, navigate],
  );

  const isLoggedIn = !!userName;

  return (
    <nav className={`landing-nav${scrolled ? ' landing-nav-scrolled' : ''}`}>
      <div className="landing-container landing-nav-inner">
        <Link to="/" className="landing-logo" onClick={handleLogoClick}>
          <img src="/logo-purple.webp" alt="Ainalytics" className="landing-logo-img" width="56" height="56" />
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
          {isLoggedIn ? (
            <>
              <span className="landing-nav-greeting">{t('landing.nav.hello', { name: userName })}</span>
              <Link to="/dashboard" className="btn btn-primary btn-sm">
                <LayoutDashboard className="w-4 h-4" />
                {t('landing.nav.dashboard')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/signin" className="btn btn-ghost btn-sm">{t('landing.nav.signIn')}</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">{t('landing.nav.getStarted')}</Link>
            </>
          )}
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
          {isLoggedIn ? (
            <>
              <span className="landing-nav-greeting" style={{ textAlign: 'center' }}>{t('landing.nav.hello', { name: userName })}</span>
              <Link to="/dashboard" className="btn btn-primary btn-sm w-full" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard className="w-4 h-4" />
                {t('landing.nav.dashboard')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/signin" className="btn btn-ghost btn-sm w-full" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.signIn')}</Link>
              <Link to="/signup" className="btn btn-primary btn-sm w-full" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.getStarted')}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
