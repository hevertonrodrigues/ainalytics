import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

function RotatingText({ words }: { words: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitIndex, setExitIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setExitIndex(currentIndex);
      
      // Select a random index that's different from the current one
      setCurrentIndex((prev) => {
        if (words.length <= 1) return 0;
        let next;
        do {
          next = Math.floor(Math.random() * words.length);
        } while (next === prev);
        return next;
      });
      
      // Clear exit index after transition duration (500ms in CSS)
      setTimeout(() => {
        setExitIndex(null);
      }, 500);
    }, 3000);
    return () => clearInterval(timer);
  }, [words.length, currentIndex]);

  return (
    <span className="hero-rotating-container">
      {words.map((word, i) => {
        const isActive = i === currentIndex;
        const isExiting = i === exitIndex;
        if (!isActive && !isExiting) return null;

        return (
          <span
            key={word}
            className={`hero-rotating-word landing-gradient-text ${isActive ? 'active' : ''} ${isExiting ? 'exit' : ''}`}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

export function LandingHero() {
  const { t } = useTranslation();
  const rotatingWords = t('landing.hero.rotatingWords', { returnObjects: true }) as string[];

  return (
    <section className="landing-hero">
      <div className="landing-hero-bg" />
      <div className="landing-container landing-hero-content">
        <h1 className="landing-hero-title">
          {t('landing.hero.title')}
          <br />
          <span>
            <span className="landing-gradient-text">{t('landing.hero.titleHighlight')}</span>
            <RotatingText words={rotatingWords} />
          </span>
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
        {/* <div className="landing-hero-image">
          <img
            src="/landing-hero.png"
            alt="Ainalytics Dashboard — AI Prompt Comparison"
            loading="eager"
          />
        </div> */}
      </div>
    </section>
  );
}
