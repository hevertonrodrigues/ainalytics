import { useState, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Eye,
  AlertTriangle,
  CheckCircle,
  Star,
  ChevronDown,
  X,
  BarChart3,
  Search,
} from 'lucide-react';
import { InterestLeadForm } from '@/components/InterestLeadForm';
import { APP_NAME } from '@/lib/constants';
import { trackCTAClick } from '@/lib/analytics';

/* ── Scroll Reveal ── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.querySelectorAll('.sales-reveal').forEach((node) => node.classList.add('visible'));
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
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' },
    );

    el.querySelectorAll('.sales-reveal').forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ── FAQ Accordion Item ── */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sales-faq-item${open ? ' open' : ''}`}>
      <button className="sales-faq-q" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <ChevronDown className="w-5 h-5 sales-faq-chevron" />
      </button>
      <div className="sales-faq-a">
        <p>{answer}</p>
      </div>
    </div>
  );
}

/* ── Main Free Analysis Landing Page ── */

export function FreeAnalysisPage() {
  const { t, i18n } = useTranslation();
  const revealRef = useScrollReveal();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [stickyCtaDismissed, setStickyCtaDismissed] = useState(false);

  // Show sticky CTA after scrolling past hero
  useEffect(() => {
    const onScroll = () => {
      if (!stickyCtaDismissed) {
        setShowStickyCta(window.scrollY > 500);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stickyCtaDismissed]);

  /* Default to pt-br unless ?lang= is explicitly in the URL */
  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (!urlLang) {
      i18n.changeLanguage('pt-br');
    }
  }, [i18n]);

  /* Dynamic meta tags */
  useEffect(() => {
    const prevTitle = document.title;
    document.title = t('freeAnalysis.heroTitle1', 'Análise GEO Gratuita | Ainalytics');

    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') ?? '';
    if (metaDesc) {
      metaDesc.setAttribute('content', t('freeAnalysis.heroSubtitle', 'Descubra se seu site está preparado para a IA.'));
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      metaDesc.setAttribute('content', t('freeAnalysis.heroSubtitle', 'Descubra se seu site está preparado para a IA.'));
      document.head.appendChild(metaDesc);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute('content', prevDesc);
    };
  }, [t]);

  const scrollToForm = () => {
    document.getElementById('free-analysis-signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isSuccess) {
    return (
      <div className="sales-page">
        <div className="sales-success-container">
          <CheckCircle className="w-20 h-20 text-success" />
          <h1>{t('interestForm.successTitle', 'Recebemos sua solicitação!')}</h1>
          <p>{t('interestForm.successMessage', 'Em breve entraremos em contato.')}</p>
          <RouterLink to="/" className="btn btn-primary btn-lg">
            {t('common.backToHome', 'Voltar para Início')}
          </RouterLink>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-page" ref={revealRef}>
      {/* ── Urgency Bar ── */}
      <div className="sales-urgency-bar">
        <TrendingUp className="w-4 h-4" />
        <span>{t('freeAnalysis.urgencyBar')}</span>
      </div>

      {/* ══════════════ HERO ══════════════ */}
      <section className="sales-hero">
        <div className="sales-hero-bg" />
        <div className="sales-container sales-hero-content">
          <div className="sales-badge-row">
            <span className="sales-badge-trial">
              <Shield className="w-3.5 h-3.5" />
              {t('freeAnalysis.badge')}
            </span>
            <span className="sales-badge-discount">
              <Zap className="w-4 h-4" />
              {t('freeAnalysis.trustBar3')}
            </span>
          </div>
          <h1 className="sales-hero-title">
            {t('freeAnalysis.heroTitle1')}
            <br />
            <span className="landing-gradient-text">{t('freeAnalysis.heroTitle2')}</span>
            <br />
            {t('freeAnalysis.heroTitle3')}
          </h1>
          <p className="sales-hero-subtitle">{t('freeAnalysis.heroSubtitle')}</p>

          <div className="sales-hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('free_analysis_hero_signup', '/analise-gratuita'); scrollToForm(); }}>
              {t('freeAnalysis.heroCta')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => { document.getElementById('free-analysis-preview')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t('freeAnalysis.heroSecondary')}
            </button>
          </div>
          <p className="sales-final-note mt-4 opacity-70 flex justify-center items-center gap-2">
            <Shield className="w-4 h-4" /> {t('freeAnalysis.finalCtaNote')}
          </p>
        </div>
      </section>

      {/* ══════════════ PAIN POINTS ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('freeAnalysis.painTitle')}</h2>
          <p className="sales-section-subtitle">{t('freeAnalysis.painSubtitle')}</p>
          <div className="sales-pain-grid">
            <div className="sales-pain-card glass-card">
              <Eye className="w-8 h-8 text-brand-accent" />
              <h3>{t('freeAnalysis.pain1Title')}</h3>
              <p>{t('freeAnalysis.pain1Desc')}</p>
            </div>
            <div className="sales-pain-card glass-card">
              <TrendingUp className="w-8 h-8 text-brand-accent" />
              <h3>{t('freeAnalysis.pain2Title')}</h3>
              <p>{t('freeAnalysis.pain2Desc')}</p>
            </div>
            <div className="sales-pain-card glass-card">
              <AlertTriangle className="w-8 h-8 text-brand-accent" />
              <h3>{t('freeAnalysis.pain3Title')}</h3>
              <p>{t('freeAnalysis.pain3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ PREVIEW / WHAT THE ANALYSIS REVEALS ══════════════ */}
      <section id="free-analysis-preview" className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">
            {t('freeAnalysis.previewTitle')}{' '}
            <span className="landing-gradient-text">{t('freeAnalysis.previewTitleHighlight')}</span>
          </h2>
          <p className="sales-section-subtitle">{t('freeAnalysis.previewSubtitle')}</p>

          {/* Mock Dashboard Preview */}
          <div className="glass-card" style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem', overflow: 'hidden' }}>
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-glass-border)', background: 'var(--color-bg-secondary)' }}>
              {/* Title bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-glass-border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-error)', opacity: 0.6 }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-warning)', opacity: 0.6 }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-success)', opacity: 0.6 }} />
                <span style={{ marginLeft: 8, height: 12, borderRadius: 999, background: 'var(--color-bg-primary)', flex: '0 0 160px' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.5rem' }}>
                {/* Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--color-bg-primary)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-xs)' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--color-warning)' }}>42</span>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GEO Score</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Emergente (Nível 2)</span>
                  </div>
                </div>
                {/* Critical Factors */}
                <div style={{ padding: '1rem', background: 'var(--color-bg-primary)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-xs)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>Fatores Críticos</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AlertTriangle style={{ width: 14, height: 14 }} /> Falta de Schema Markup
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AlertTriangle style={{ width: 14, height: 14 }} /> Menções ausentes no ChatGPT
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ SOLUTION / WHAT YOU GET ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">
            {t('freeAnalysis.solutionTitle')}{' '}
            <span className="landing-gradient-text">{t('freeAnalysis.solutionTitleHighlight')}</span>
          </h2>
          <p className="sales-section-subtitle">{t('freeAnalysis.solutionSubtitle')}</p>
          <div className="sales-bullets-grid">
            {[
              { key: 'solutionItem1', icon: BarChart3 },
              { key: 'solutionItem2', icon: Search },
              { key: 'solutionItem3', icon: Zap },
              { key: 'solutionItem4', icon: AlertTriangle },
              { key: 'solutionItem5', icon: CheckCircle },
            ].map(({ key, icon: Icon }) => (
              <div key={key} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
                  <Icon className="w-5 h-5 text-success" />
                  {t(`freeAnalysis.${key}Title`)}
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                  {t(`freeAnalysis.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">
            {t('freeAnalysis.howItWorksTitle')}{' '}
            <span className="landing-gradient-text">{t('freeAnalysis.howItWorksTitleHighlight')}</span>
          </h2>
          <div className="sales-pain-grid" style={{ marginTop: '2rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-pain-card glass-card">
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-accent))', color: 'white', fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>
                  {i}
                </span>
                <h3>{t(`freeAnalysis.step${i}Title`)}</h3>
                <p>{t(`freeAnalysis.step${i}Desc`)}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('free_analysis_how_cta', '/analise-gratuita'); scrollToForm(); }}>
              {t('freeAnalysis.howItWorksCta')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ URGENCY ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container" style={{ textAlign: 'center' }}>
          <h2 className="sales-section-title">
            {t('freeAnalysis.urgencyTitle')}{' '}
            <span style={{ color: 'var(--color-error)' }}>{t('freeAnalysis.urgencyTitleHighlight')}</span>
          </h2>
          <p className="sales-section-subtitle" style={{ maxWidth: 700 }}>{t('freeAnalysis.urgencyDesc')}</p>
          <div className="sales-pain-grid" style={{ marginTop: '1.5rem' }}>
            <div className="sales-pain-card glass-card">
              <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>40%</span>
              <p>{t('freeAnalysis.stat1')}</p>
            </div>
            <div className="sales-pain-card glass-card">
              <TrendingUp className="w-8 h-8" style={{ color: 'var(--color-warning)' }} />
              <p>{t('freeAnalysis.stat2')}</p>
            </div>
            <div className="sales-pain-card glass-card">
              <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--color-success)' }}>1º</span>
              <p>{t('freeAnalysis.stat3')}</p>
            </div>
          </div>
          <div style={{ marginTop: '2rem' }}>
            <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('free_analysis_urgency_cta', '/analise-gratuita'); scrollToForm(); }}>
              {t('freeAnalysis.urgencyCta')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ SOCIAL PROOF ══════════════ */}
      <section className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('freeAnalysis.proofTitle')}</h2>
          <div className="sales-proof-row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-proof-card glass-card">
                <div className="sales-proof-stars">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star key={j} className="w-4 h-4" />
                  ))}
                </div>
                <p className="sales-proof-text">"{t(`freeAnalysis.testim${i}`)}"</p>
                <span className="sales-proof-author">{t(`freeAnalysis.testimAuthor${i}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ SIGNUP FORM ══════════════ */}
      <section id="free-analysis-signup" className="sales-section sales-reveal">
        <div className="sales-container">
          <div className="sales-offer-card glass-card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="sales-offer-header" style={{ paddingBottom: '1rem' }}>
              <div className="sales-badge-row" style={{ justifyContent: 'center' }}>
                <span className="sales-badge-trial">
                  <Shield className="w-3.5 h-3.5" />
                  {t('freeAnalysis.badge')}
                </span>
              </div>
              <h2>{t('freeAnalysis.formTitle')}</h2>
              <p className="sales-offer-subtitle">{t('freeAnalysis.formSubtitle')}</p>
            </div>

            <div className="sales-offer-body" style={{ padding: '2rem' }}>
              <InterestLeadForm
                variant="free-analysis"
                submitLabel={t('freeAnalysis.heroCta')}
                onSuccess={() => setIsSuccess(true)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ OBJECTION FAQ ══════════════ */}
      <section className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container sales-faq-container">
          <h2 className="sales-section-title">{t('freeAnalysis.faqTitle')}</h2>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <FaqItem
              key={i}
              question={t(`freeAnalysis.faq${i}Q`)}
              answer={t(`freeAnalysis.faq${i}A`)}
            />
          ))}
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="sales-final-cta sales-reveal">
        <div className="sales-container">
          <TrendingUp className="w-10 h-10 text-brand-secondary" />
          <h2>{t('freeAnalysis.finalCtaTitle')}</h2>
          <p>{t('freeAnalysis.finalCtaDesc')}</p>
          <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('free_analysis_final_cta', '/analise-gratuita'); scrollToForm(); }}>
            {t('freeAnalysis.finalCtaButton')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <span className="sales-final-note">{t('freeAnalysis.finalCtaNote')}</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sales-footer">
        <p>© {new Date().getFullYear()} {APP_NAME}. {t('landing.footer.rights', 'Todos os direitos reservados.')}</p>
        <div className="sales-footer-links">
          <RouterLink to="/terms" target="_blank" rel="noopener noreferrer">{t('landing.footer.terms', 'Termos')}</RouterLink>
          <RouterLink to="/privacy" target="_blank" rel="noopener noreferrer">{t('landing.footer.privacy', 'Privacidade')}</RouterLink>
          <RouterLink to="/contact" target="_blank" rel="noopener noreferrer">{t('landing.footer.contact', 'Contato')}</RouterLink>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className={`sales-sticky-cta ${showStickyCta && !stickyCtaDismissed ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={() => { trackCTAClick('free_analysis_sticky_signup', '/analise-gratuita'); scrollToForm(); }}>
          {t('freeAnalysis.stickyMobileCta')}
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          className="sales-sticky-cta-dismiss"
          onClick={() => setStickyCtaDismissed(true)}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
