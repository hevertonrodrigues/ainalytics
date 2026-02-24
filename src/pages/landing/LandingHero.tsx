import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

export function LandingHero() {
  const { t } = useTranslation();

  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" />
      <div className="landing-container landing-hero-content">
        <h1 className="landing-hero-title">
          {t('landing.hero.title')}
          <br />
          <span className="landing-gradient-text">{t('landing.hero.titleHighlight')}</span>
          <br />
          {t('landing.hero.titleEnd')}
        </h1>
        <p className="landing-hero-subtitle">{t('landing.hero.subtitle')}</p>
        <div className="landing-hero-cta">
          <Link to="/signup" className="btn btn-primary btn-lg">
            {t('landing.hero.cta')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#preview" className="btn btn-secondary btn-lg">
            {t('landing.hero.ctaSecondary')}
          </a>
        </div>
        <p className="landing-hero-trust">{t('landing.hero.trustedBy')}</p>
        <div className="landing-hero-image">
          <img
            src="/landing-hero.png"
            alt="Ainalytics Dashboard — AI Prompt Comparison"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}
