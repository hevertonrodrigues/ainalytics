import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// import { Twitter, Linkedin, Github } from 'lucide-react';
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
        {/* <div className="landing-footer-brand">
          <div className="landing-logo">
            <img src="/logo-purple.png" alt="Ainalytics" className="landing-logo-img landing-logo-img-sm" />
            <span>{APP_NAME}</span>
          </div>
          <p>{t('landing.footer.description')}</p>
          <div className="landing-footer-social">
            <a href="#" aria-label="Twitter / X" target="_blank" rel="noopener noreferrer">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-4 h-4" />
            </a>
            <a href="#" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="landing-footer-links">
          <h4>{t('landing.footer.product')}</h4>
          <a href="#features">{t('landing.nav.features')}</a>
          <a href="#pricing">{t('landing.nav.pricing')}</a>
          <a href="#how-it-works">{t('landing.nav.howItWorks')}</a>
        </div>

        <div className="landing-footer-links">
          <h4>{t('landing.footer.company')}</h4>
          <a href="#">{t('landing.footer.about')}</a>
          <a href="#">{t('landing.footer.blog')}</a>
          <a href="#">{t('landing.footer.careers')}</a>
        </div>

        <div className="landing-footer-links">
          <h4>{t('landing.footer.support')}</h4>
          <a href="#">{t('landing.footer.contact')}</a>
          <a href="#">{t('landing.footer.documentation')}</a>
          <a href="#">{t('landing.footer.status')}</a>
        </div>

        <div className="landing-footer-links">
          <h4>{t('landing.footer.legal')}</h4>
          <a href="#">{t('landing.footer.privacy')}</a>
          <a href="#">{t('landing.footer.terms')}</a>
        </div> */}

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
