import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Instagram } from 'lucide-react';
import { APP_NAME, LOCALES } from '@/lib/constants';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

export function LandingFooter() {
  const { t, i18n } = useTranslation();

  const changeLang = useCallback(
    (lng: string) => { i18n.changeLanguage(lng); },
    [i18n],
  );

  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <div className="landing-footer-brand">
          <div className="landing-logo">
            <img src="/logo-purple.webp" alt="Ainalytics" className="landing-logo-img landing-logo-img-sm" width="32" height="32" />
            <span>{APP_NAME}</span>
          </div>
          <p>{t('landing.footer.description')}</p>
          <div className="landing-footer-social">
            <a href="https://instagram.com/ainalytics.ai" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="landing-footer-links">
          <h3>{t('landing.footer.product')}</h3>
          <a href="#features">{t('landing.nav.features')}</a>
          <a href="#how-it-works">{t('landing.nav.howItWorks')}</a>
          <a href="#pricing">{t('landing.nav.pricing')}</a>
          <a href="#faq">{t('landing.footer.faq')}</a>
        </div>

        <div className="landing-footer-links">
          <h3>{t('landing.footer.company')}</h3>
          <a href="#about">{t('landing.footer.about')}</a>
          <a href="#blog">{t('landing.footer.blog')}</a>
        </div>

        <div className="landing-footer-links">
          <h3>{t('landing.footer.support')}</h3>
          <Link to="/contact">{t('landing.footer.contact')}</Link>
          <a href="#faq">{t('landing.footer.faq')}</a>
        </div>

        <div className="landing-footer-links">
          <h3>{t('landing.footer.legal')}</h3>
          <Link to="/privacy">{t('landing.footer.privacy')}</Link>
          <Link to="/terms">{t('landing.footer.terms')}</Link>
        </div>

        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} {APP_NAME}. {t('landing.footer.rights')}</span>
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
        </div>
      </div>
    </footer>
  );
}
