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
  X,
  CalendarCheck,
} from 'lucide-react';
import { Suspense, lazy } from 'react';
import { trackCTAClick, trackBookCallClick, trackActivity, trackPageView } from '@/lib/analytics';

const PricingPlans = lazy(() => import('@/components/PricingPlans').then(m => ({ default: m.PricingPlans })));
const InterestFormModal = lazy(() => import('@/components/InterestFormModal').then(m => ({ default: m.InterestFormModal })));
const LandingFAQ = lazy(() => import('./LandingFAQ').then(m => ({ default: m.LandingFAQ })));
const LandingFooter = lazy(() => import('./LandingFooter').then(m => ({ default: m.LandingFooter })));

import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/lib/supabase';
import { useSeo, ORG_JSONLD, WEBSITE_JSONLD, HREFLANG_LANDING, SITE_URL } from '@/lib/seo';
import type { Plan } from '@/types';
import type { PricingPlan } from '@/components/PricingPlans';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';

const AI_PLATFORMS = ['OpenAI', 'Anthropic', 'Google Gemini', 'xAI Grok', 'Perplexity'];

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

/* ────────────────────────────────────────────────────────────
   Section visibility tracking hook
   ──────────────────────────────────────────────────────────── */

function useSectionTracking() {
  const trackedRef = useRef<Set<string>>(new Set());

  const sectionRefCallback = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const sectionId = el.getAttribute('data-track-section');
    if (!sectionId || trackedRef.current.has(sectionId)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !trackedRef.current.has(sectionId)) {
          trackedRef.current.add(sectionId);
          trackActivity({
            event_type: 'landing_section',
            event_action: 'viewed',
            event_target: sectionId,
            metadata: { scroll_depth: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100) / 100 },
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
  }, []);

  return sectionRefCallback;
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  // SEO/GEO — set per-language title/description, canonical pointing
  // to the active locale URL, and Organization+WebSite JSON-LD that AI
  // engines (ChatGPT, Claude, Gemini, Perplexity) ingest for entity
  // recognition. The static index.html only ships the EN version; this
  // hook overrides it with the active locale's copy.
  const lang = (i18n.language || 'en').toLowerCase();
  const canonicalLandingPath = lang === 'en' || !['en', 'es', 'pt-br'].includes(lang) ? '/' : `/${lang}`;
  useSeo({
    title: t('landing.seo.title', 'Ainalytics — AI Visibility Monitoring Platform | Know What AI Says About You'),
    description: t(
      'landing.seo.description',
      "Monitor your brand's visibility across ChatGPT, Claude, Gemini and Grok. Ainalytics tracks how AI platforms talk about your brand in real time, so you never lose visibility to competitors.",
    ),
    canonical: `${SITE_URL}${canonicalLandingPath}`,
    robots: 'index,follow',
    og: {
      type: 'website',
      siteName: 'Ainalytics',
      image: `${SITE_URL}/landing-hero.png`,
      locale: lang === 'pt-br' ? 'pt_BR' : lang === 'es' ? 'es_ES' : 'en_US',
    },
    hreflang: HREFLANG_LANDING,
    jsonLd: [WEBSITE_JSONLD, ORG_JSONLD],
  });
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [stickyCtaDismissed, setStickyCtaDismissed] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const { formatPrice: formatCurrency } = useCurrency();
  const revealRef = useScrollReveal();
  const trackSection = useSectionTracking();

  // Track landing page view on mount
  useEffect(() => {
    trackPageView('/');
  }, []);

  // Fetch plans from database
  useEffect(() => {
    async function loadPlans() {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setPlans(data || []);
      } catch (err) {
        console.error('Failed to load plans:', err);
      } finally {
        setPlansLoading(false);
      }
    }
    loadPlans();
  }, []);

  const formatPlanPrice = (plan: Plan) => {
    if ((plan.settings as Record<string, unknown>)?.custom_pricing) {
      return t('plans.custom');
    }
    return formatCurrency(plan.price);
  };

  const getFeatures = (plan: Plan): string[] => {
    const lang = i18n.language || 'en';
    return plan.features?.[lang] || plan.features?.['en'] || [];
  };

  const getDescription = (plan: Plan): string => {
    const settings = plan.settings as Record<string, unknown>;
    const desc = settings?.description;
    if (!desc) return '';
    if (typeof desc === 'object') {
      const lang = i18n.language || 'en';
      return (desc as Record<string, string>)[lang] || (desc as Record<string, string>)['en'] || '';
    }
    return desc as string;
  };

  const pricingPlans: PricingPlan[] = plans.map((plan, idx) => {
    const isPopular = plan.name === 'Growth';
    const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;

    return {
      name: plan.name,
      price: formatPlanPrice(plan),
      priceLabel: plan.price > 0 ? t('landing.pricing.monthly') : undefined,
      description: getDescription(plan),
      features: getFeatures(plan),
      popular: isPopular ? t('plans.mostPopular') : undefined,
      trialDays: plan.trial,
      isBlock: idx >= 3,
      cta: isCustom ? t('landing.pricing.custom.cta') : t('landing.pricing.free.cta'),
      onSelect: isCustom ? () => setInterestModalOpen(true) : undefined,
    };
  });

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      // Show sticky CTA after scrolling past the hero (~500px)
      if (!stickyCtaDismissed) {
        setShowStickyCta(window.scrollY > 500);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stickyCtaDismissed]);

  return (
    <div className="landing-page" ref={revealRef}>
      <LandingHeader scrolled={scrolled} />

      <main>
      <LandingHero />

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
      <section id="features" className="landing-section" data-track-section="features" ref={trackSection}>
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
      <section id="how-it-works" className="landing-section landing-section-alt" data-track-section="how-it-works" ref={trackSection}>
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
          {/* <div className="landing-preview-image landing-reveal">
            <img
              src="/landing-dashboard.png"
              alt="Ainalytics Analytics Dashboard"
              loading="lazy"
            />
          </div> */}
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="landing-section landing-section-alt" data-track-section="pricing" ref={trackSection}>
        <div className="landing-container">
          <div className="landing-section-header landing-reveal">
            <h2>
              {t('landing.pricing.title')}{' '}
              <span className="landing-gradient-text">{t('landing.pricing.titleHighlight')}</span>
            </h2>
            <p>{t('landing.pricing.subtitle')}</p>
          </div>
          {plansLoading ? (
            <div className="landing-pricing-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-96 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <Suspense fallback={<div className="landing-pricing-grid">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-96 w-full rounded-xl" />)}</div>}>
              <PricingPlans plans={pricingPlans} numericPrices={plans.map(p => p.price)} formatPrice={formatCurrency} />
            </Suspense>
          )}
        </div>
      </section>

      {/* ─── Book a Call ─── */}
      <section className="landing-book-call landing-reveal" data-track-section="book-call" ref={trackSection}>
        <div className="landing-container landing-book-call-inner">
          <CalendarCheck className="w-10 h-10" style={{ color: 'var(--brand-secondary)' }} />
          <h2>{t('landing.bookCall.title')}</h2>
          <p>{t('landing.bookCall.subtitle')}</p>
          <a
            href="https://fantastical.app/nadai/ainalytics"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-lg btn-book-call"
            onClick={() => trackBookCallClick('mid_section', '/landing')}
          >
            <CalendarCheck className="w-5 h-5" />
            {t('landing.bookCall.cta')}
          </a>
          <span className="landing-book-call-note">{t('landing.bookCall.note')}</span>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="landing-final-cta landing-reveal" data-track-section="final-cta" ref={trackSection}>
        <div className="landing-container landing-final-cta-inner">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.subtitle')}</p>
          <Link to="/signup" className="btn btn-primary btn-lg" onClick={() => trackCTAClick('final_cta_signup', '/landing')}>
            {t('landing.cta.button')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="landing-no-card">{t('landing.cta.noCard')}</span>
          <a
            href="https://fantastical.app/nadai/ainalytics"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-cta-book-call-alt"
            onClick={() => trackBookCallClick('final_cta', '/landing')}
          >
            <CalendarCheck className="w-4 h-4" />
            {t('landing.cta.bookCall')}
          </a>
        </div>
      </section>

      <Suspense fallback={<div className="h-96 skeleton" />}>
        <LandingFAQ />
      </Suspense>
      </main>

      <Suspense fallback={<div className="h-64 skeleton" />}>
        <LandingFooter />
      </Suspense>

      {/* Interest Form Modal */}
      <Suspense fallback={null}>
        <InterestFormModal
          open={interestModalOpen}
          onClose={() => setInterestModalOpen(false)}
        />
      </Suspense>

      {/* Mobile Sticky CTA */}
      <div className={`landing-sticky-cta ${showStickyCta && !stickyCtaDismissed ? 'visible' : ''}`}>
        <Link to="/signup" className="btn btn-primary" onClick={() => trackCTAClick('sticky_signup', '/landing')}>
          {t('landing.hero.cta')}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <a
          href="https://fantastical.app/nadai/ainalytics"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-book-call-sticky"
          onClick={() => trackBookCallClick('sticky', '/landing')}
        >
          <CalendarCheck className="w-4 h-4" />
        </a>
        <button
          className="landing-sticky-cta-dismiss"
          onClick={() => setStickyCtaDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
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
