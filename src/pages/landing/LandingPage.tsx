import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  GitCompareArrows,
  Globe,
  FolderKanban,
  Users,
  BarChart3,
  Languages,
  Search,
  ChevronRight,
  ArrowRight,
  Menu,
  X,
  Twitter,
  Linkedin,
  Github,
} from 'lucide-react';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { PricingPlans } from '@/components/PricingPlans';
import { InterestFormModal } from '@/components/InterestFormModal';

const AI_PLATFORMS = ['OpenAI', 'Anthropic', 'Google Gemini', 'xAI Grok', 'Perplexity'];

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  es: 'ES',
  'pt-br': 'PT',
};

/* ────────────────────────────────────────────────────────────
   Scroll-reveal hook
   ──────────────────────────────────────────────────────────── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.querySelectorAll('.landing-reveal').forEach((node) => node.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    el.querySelectorAll('.landing-reveal').forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return ref;
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const revealRef = useScrollReveal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const changeLang = useCallback(
    (lng: string) => {
      i18n.changeLanguage(lng);
      setMobileMenuOpen(false);
    },
    [i18n],
  );

  return (
    <div className="landing-page" ref={revealRef}>
      {/* ─── Navbar ─── */}
      <nav className={`landing-nav${scrolled ? ' landing-nav-scrolled' : ''}`}>
        <div className="landing-container landing-nav-inner">
          <Link to="/" className="landing-logo">
            <img src="/logo.svg" alt="Ainalytics" className="landing-logo-img" />
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

      {/* ─── Hero ─── */}
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

      {/* ─── Logo Bar ─── */}
      <section className="landing-logos landing-reveal">
        <div className="landing-container">
          <p className="landing-logos-title">{t('landing.logos.title')}</p>
          <div className="landing-logos-grid">
            {AI_PLATFORMS.map((name) => (
              <div key={name} className="landing-logo-item">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <h2>
              {t('landing.features.title')}{' '}
              <span className="landing-gradient-text">{t('landing.features.titleHighlight')}</span>
            </h2>
            <p>{t('landing.features.subtitle')}</p>
          </div>
          <div className="landing-features-grid">
            <FeatureCard
              icon={<GitCompareArrows className="w-6 h-6" />}
              title={t('landing.features.multiModel.title')}
              description={t('landing.features.multiModel.description')}
              delay={0}
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6" />}
              title={t('landing.features.webSearch.title')}
              description={t('landing.features.webSearch.description')}
              delay={1}
            />
            <FeatureCard
              icon={<FolderKanban className="w-6 h-6" />}
              title={t('landing.features.topicOrg.title')}
              description={t('landing.features.topicOrg.description')}
              delay={2}
            />
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title={t('landing.features.multiTenant.title')}
              description={t('landing.features.multiTenant.description')}
              delay={0}
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title={t('landing.features.analytics.title')}
              description={t('landing.features.analytics.description')}
              delay={1}
            />
            <FeatureCard
              icon={<Languages className="w-6 h-6" />}
              title={t('landing.features.i18n.title')}
              description={t('landing.features.i18n.description')}
              delay={2}
            />
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <h2>
              {t('landing.howItWorks.title')}{' '}
              <span className="landing-gradient-text">{t('landing.howItWorks.titleHighlight')}</span>
            </h2>
            <p>{t('landing.howItWorks.subtitle')}</p>
          </div>
          <div className="landing-steps">
            <StepCard
              number="01"
              icon={<FolderKanban className="w-7 h-7" />}
              label={t('landing.howItWorks.step1.label')}
              title={t('landing.howItWorks.step1.title')}
              description={t('landing.howItWorks.step1.description')}
              delay={0}
            />
            <div className="landing-step-arrow">
              <ChevronRight className="w-6 h-6" />
            </div>
            <StepCard
              number="02"
              icon={<Search className="w-7 h-7" />}
              label={t('landing.howItWorks.step2.label')}
              title={t('landing.howItWorks.step2.title')}
              description={t('landing.howItWorks.step2.description')}
              delay={1}
            />
            <div className="landing-step-arrow">
              <ChevronRight className="w-6 h-6" />
            </div>
            <StepCard
              number="03"
              icon={<BarChart3 className="w-7 h-7" />}
              label={t('landing.howItWorks.step3.label')}
              title={t('landing.howItWorks.step3.title')}
              description={t('landing.howItWorks.step3.description')}
              delay={2}
            />
          </div>
        </div>
      </section>

      {/* ─── Dashboard Preview ─── */}
      <section id="preview" className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <h2>
              {t('landing.preview.title')}{' '}
              <span className="landing-gradient-text">{t('landing.preview.titleHighlight')}</span>
            </h2>
            <p>{t('landing.preview.subtitle')}</p>
          </div>
          <div className="landing-preview-image landing-reveal">
            <img
              src="/landing-dashboard.png"
              alt="Ainalytics Analytics Dashboard"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <h2>
              {t('landing.pricing.title')}{' '}
              <span className="landing-gradient-text">{t('landing.pricing.titleHighlight')}</span>
            </h2>
            <p>{t('landing.pricing.subtitle')}</p>
          </div>
          <PricingPlans
            plans={[
              {
                name: t('landing.pricing.free.name'),
                price: t('landing.pricing.free.price'),
                priceLabel: t('landing.pricing.monthly'),
                description: t('landing.pricing.free.description'),
                cta: t('landing.pricing.free.cta'),
                features: t('landing.pricing.free.features', { returnObjects: true }) as string[],
              },
              {
                name: t('landing.pricing.pro.name'),
                price: t('landing.pricing.pro.price'),
                priceLabel: t('landing.pricing.monthly'),
                description: t('landing.pricing.pro.description'),
                cta: t('landing.pricing.pro.cta'),
                features: t('landing.pricing.pro.features', { returnObjects: true }) as string[],
                popular: t('landing.pricing.pro.popular'),
              },
              {
                name: t('landing.pricing.enterprise.name'),
                price: t('landing.pricing.enterprise.price'),
                priceLabel: t('landing.pricing.monthly'),
                description: t('landing.pricing.enterprise.description'),
                cta: t('landing.pricing.enterprise.cta'),
                features: t('landing.pricing.enterprise.features', { returnObjects: true }) as string[],
              },
              {
                name: t('landing.pricing.custom.name'),
                price: t('landing.pricing.custom.price'),
                description: t('landing.pricing.custom.description'),
                cta: t('landing.pricing.custom.cta'),
                features: t('landing.pricing.custom.features', { returnObjects: true }) as string[],
                isBlock: true,
                onSelect: () => setInterestModalOpen(true),
              },
            ]}
          />
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="landing-final-cta landing-reveal">
        <div className="landing-container landing-final-cta-inner">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.subtitle')}</p>
          <Link to="/signup" className="btn btn-primary btn-lg">
            {t('landing.cta.button')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="landing-no-card">{t('landing.cta.noCard')}</span>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-logo">
              <img src="/logo.svg" alt="Ainalytics" className="landing-logo-img landing-logo-img-sm" />
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
          </div>

          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} {APP_NAME}. {t('landing.footer.rights')}</span>
            <span className="landing-footer-made">{t('landing.footer.madeWith')}</span>
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

      {/* Interest Form Modal */}
      <InterestFormModal
        open={interestModalOpen}
        onClose={() => setInterestModalOpen(false)}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────── */

function FeatureCard({ icon, title, description, delay = 0 }: { icon: React.ReactNode; title: string; description: string; delay?: number }) {
  return (
    <div className={`landing-feature-card glass-card landing-reveal landing-reveal-delay-${delay}`}>
      <div className="landing-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function StepCard({
  number,
  icon,
  label,
  title,
  description,
  delay = 0,
}: {
  number: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div className={`landing-step-card landing-reveal landing-reveal-delay-${delay}`}>
      <div className="landing-step-number">{number}</div>
      <div className="landing-step-icon">{icon}</div>
      <span className="landing-step-label">{label}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
