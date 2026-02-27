import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { PricingPlans } from '@/components/PricingPlans';
import { useCurrency } from '@/hooks/useCurrency';
import { InterestFormModal } from '@/components/InterestFormModal';
import { supabase } from '@/lib/supabase';
import type { Plan } from '@/types';
import type { PricingPlan } from '@/components/PricingPlans';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingFooter } from './LandingFooter';

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

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const { formatPrice: formatCurrency } = useCurrency();
  const revealRef = useScrollReveal();

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
    return (settings?.description as string) || '';
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
      isBlock: idx >= 3,
      cta: isCustom ? t('landing.pricing.custom.cta') : t('landing.pricing.free.cta'),
      onSelect: isCustom ? () => setInterestModalOpen(true) : undefined,
    };
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page" ref={revealRef}>
      <LandingHeader scrolled={scrolled} />

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
      <section id="pricing" className="landing-section landing-section-alt">
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
            <PricingPlans plans={pricingPlans} />
          )}
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

      <LandingFooter />

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
