import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Eye,
  AlertTriangle,
  CheckCircle,
  Star,
  ChevronDown,
} from 'lucide-react';
import { SignUpForm } from '@/components/SignUpForm';
import { APP_NAME } from '@/lib/constants';



const PROMO_CODE = 'STARTER60';
const DISCOUNT_PERCENT = 60;

/* ── Per-locale pricing (monthly display, billed annually) ── */
const PRICING: Record<string, { symbol: string; originalMonthly: number; discountedMonthly: number }> = {
  en:      { symbol: '$',  originalMonthly: 99,     discountedMonthly: 39.60 },
  es:      { symbol: '$',  originalMonthly: 99,     discountedMonthly: 39.60 },
  'pt-br': { symbol: 'R$', originalMonthly: 495,    discountedMonthly: 198 },
};

const DEFAULT_PRICING = PRICING.en;

function getPricing(lang: string): { symbol: string; originalMonthly: number; discountedMonthly: number } {
  return (PRICING[lang] ?? DEFAULT_PRICING)!;
}

function formatPrice(amount: number, symbol: string) {
  // For BRL use comma as decimal separator
  if (symbol === 'R$') {
    return `${symbol} ${amount.toFixed(2).replace('.', ',')}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

/* ── Countdown Timer ── */

function useCountdown(hours: number) {
  const endRef = useRef<number>(0);

  if (endRef.current === 0) {
    const stored = sessionStorage.getItem('sales_countdown_end');
    if (stored) {
      endRef.current = Number(stored);
    } else {
      endRef.current = Date.now() + hours * 60 * 60 * 1000;
      sessionStorage.setItem('sales_countdown_end', String(endRef.current));
    }
  }

  const calcRemaining = () => Math.max(0, endRef.current - Date.now());
  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSeconds = Math.floor(remaining / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return { hours: hrs, minutes: mins, seconds: secs, expired: remaining <= 0 };
}

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

/* ── Main Sales Page ── */

export function SalesPage() {
  const { t, i18n } = useTranslation();
  const countdown = useCountdown(48);
  const revealRef = useScrollReveal();
  const [isSuccess, setIsSuccess] = useState(false);

  /* Prevent search-engine indexing — paid media only */
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);



  const pad = (n: number) => String(n).padStart(2, '0');

  const scrollToForm = () => {
    document.getElementById('sales-signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isSuccess) {
    return (
      <div className="sales-page">
        <div className="sales-success-container">
          <CheckCircle className="w-20 h-20 text-success" />
          <h1>{t('sales.successTitle')}</h1>
          <p>{t('sales.successDesc')}</p>
          <Link to="/signin" className="btn btn-primary btn-lg">
            {t('auth.goToSignIn')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-page" ref={revealRef}>
      {/* ── Urgency Bar ── */}
      <div className="sales-urgency-bar">
        <AlertTriangle className="w-4 h-4" />
        <span>{t('sales.urgencyBar')}</span>
        <div className="sales-countdown">
          <span className="sales-countdown-unit">{pad(countdown.hours)}<small>h</small></span>
          <span className="sales-countdown-sep">:</span>
          <span className="sales-countdown-unit">{pad(countdown.minutes)}<small>m</small></span>
          <span className="sales-countdown-sep">:</span>
          <span className="sales-countdown-unit">{pad(countdown.seconds)}<small>s</small></span>
        </div>
      </div>

      {/* ══════════════ HERO ══════════════ */}
      <section className="sales-hero">
        <div className="sales-hero-bg" />
        <div className="sales-container sales-hero-content">
          <div className="sales-badge-row">
            <span className="sales-badge-discount">
              <Zap className="w-4 h-4" />
              {t('sales.badge', { discount: DISCOUNT_PERCENT })}
            </span>
            <span className="sales-badge-limited">
              <Clock className="w-3.5 h-3.5" />
              {t('sales.badgeLimited')}
            </span>
          </div>
          <h1 className="sales-hero-title">
            {t('sales.heroTitle1')}
            <br />
            <span className="landing-gradient-text">{t('sales.heroTitle2')}</span>
            <br />
            {t('sales.heroTitle3')}
          </h1>
          <p className="sales-hero-subtitle">{t('sales.heroSubtitle')}</p>
          <div className="sales-hero-cta">
            <button className="btn btn-primary btn-lg" onClick={scrollToForm}>
              {t('sales.heroCta')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════ PAIN POINTS ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('sales.painTitle')}</h2>
          <div className="sales-pain-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-pain-card glass-card">
                <Eye className="w-8 h-8 text-brand-accent" />
                <h3>{t(`sales.pain${i}Title`)}</h3>
                <p>{t(`sales.pain${i}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ FASCINATION BULLETS ══════════════ */}
      <section className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('sales.bulletsTitle')}</h2>
          <p className="sales-section-subtitle">{t('sales.bulletsSubtitle')}</p>
          <div className="sales-bullets-grid">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="sales-bullet">
                <CheckCircle className="w-5 h-5 text-success" />
                <span>{t(`sales.bullet${i + 1}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ SOCIAL PROOF ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <div className="sales-proof-row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-proof-card glass-card">
                <div className="sales-proof-stars">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star key={j} className="w-4 h-4" />
                  ))}
                </div>
                <p className="sales-proof-text">"{t(`sales.testimonial${i}`)}"</p>
                <span className="sales-proof-author">{t(`sales.testimonialAuthor${i}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ OFFER + SIGNUP FORM ══════════════ */}
      <section id="sales-signup" className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <div className="sales-offer-card glass-card">
            <div className="sales-offer-header">
              <span className="sales-badge-discount">
                <Zap className="w-4 h-4" />
                {t('sales.badge', { discount: DISCOUNT_PERCENT })}
              </span>
              <h2>{t('sales.offerTitle')}</h2>
              <p className="sales-offer-subtitle">{t('sales.offerSubtitle')}</p>
            </div>

            <div className="sales-offer-body">
              {/* Price comparison */}
              {(() => {
                const p = getPricing(i18n.language);
                return (
                  <>
                    <div className="sales-price-compare">
                      <div className="sales-price-old">
                        <span className="sales-price-label">{t('sales.priceWas')}</span>
                        <span className="sales-price-amount-old">{formatPrice(p.originalMonthly, p.symbol)}</span>
                        <span className="sales-price-period">/{t('sales.perMonth')}</span>
                      </div>
                      <ArrowRight className="w-6 h-6 text-success" />
                      <div className="sales-price-new">
                        <span className="sales-price-label">{t('sales.priceNow')}</span>
                        <span className="sales-price-amount-new">{formatPrice(p.discountedMonthly, p.symbol)}</span>
                        <span className="sales-price-period">/{t('sales.perMonth')}</span>
                      </div>
                    </div>
                    <p className="sales-billed-annually">{t('sales.billedAnnually')}</p>
                  </>
                );
              })()}

              {/* What's included */}
              <div className="sales-included">
                <h3>{t('sales.includedTitle')}</h3>
                <ul>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <li key={i}>
                      <CheckCircle className="w-4 h-4 text-success" />
                      {t(`sales.included${i}`)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Guarantee */}
              <div className="sales-guarantee">
                <Shield className="w-6 h-6" />
                <div>
                  <strong>{t('sales.guaranteeTitle')}</strong>
                  <p>{t('sales.guaranteeDesc')}</p>
                </div>
              </div>

              {/* Sign Up Form */}
              <div className="sales-form-wrapper">
                <h3>{t('sales.formTitle')}</h3>
                <SignUpForm
                  showPromoCode
                  defaultPromoCode={PROMO_CODE}
                  submitLabel={t('sales.formCta')}
                  onConfirmEmail={() => setIsSuccess(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ OBJECTION FAQ ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container sales-faq-container">
          <h2 className="sales-section-title">{t('sales.faqTitle')}</h2>
          {[1, 2, 3, 4, 5].map((i) => (
            <FaqItem
              key={i}
              question={t(`sales.faq${i}Q`)}
              answer={t(`sales.faq${i}A`)}
            />
          ))}
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="sales-final-cta sales-reveal">
        <div className="sales-container">
          <TrendingUp className="w-10 h-10 text-brand-secondary" />
          <h2>{t('sales.finalCtaTitle')}</h2>
          <p>{t('sales.finalCtaDesc')}</p>
          <button className="btn btn-primary btn-lg" onClick={scrollToForm}>
            {t('sales.finalCtaButton')}
            <ArrowRight className="w-5 h-5" />
          </button>
          <span className="sales-final-note">{t('sales.finalCtaNote')}</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sales-footer">
        <p>© {new Date().getFullYear()} {APP_NAME}. {t('landing.footer.rights')}</p>
        <div className="sales-footer-links">
          <Link to="/terms" target="_blank" rel="noopener noreferrer">{t('landing.footer.terms')}</Link>
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">{t('landing.footer.privacy')}</Link>
          <Link to="/contact" target="_blank" rel="noopener noreferrer">{t('landing.footer.contact')}</Link>
        </div>
      </footer>
    </div>
  );
}
