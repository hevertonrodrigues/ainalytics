import { useState, useEffect, useRef, useCallback, Suspense, lazy, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  motion,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
  type Transition,
} from 'framer-motion';
import {
  ArrowRight,
  Globe,
  Mail,
  User,
  Briefcase,
  Building2,
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
  BarChart3,
  Quote,
  Zap,
  Users,
  Network,
  Activity,
  TrendingUp,
  Brain,
  Compass,
} from 'lucide-react';
import { LandingHeader } from './LandingHeader';
import { AnalyzingOverlay } from '@/pages/onboarding/AnalyzingOverlay';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import { useScrollLock } from '@/hooks/useScrollLock';
import { executeRecaptchaForPublicAction } from '@/lib/recaptcha';
import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY, APP_NAME } from '@/lib/constants';
import { trackPageView, trackActivity, trackCTAClick } from '@/lib/analytics';
import { useSeo, breadcrumbList, SITE_URL } from '@/lib/seo';
import type { Iso2 } from 'intl-tel-input/data';

const LandingFooter = lazy(() => import('./LandingFooter').then(m => ({ default: m.LandingFooter })));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
const ANALYZING_DURATION_MS = 6000;

const LANGUAGE_COUNTRY_MAP: Record<string, Iso2> = {
  'pt-br': 'br',
  'es': 'es',
  'en': 'us',
};

const AI_PLATFORMS = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'Perplexity'];

/* ──────────────────────────────────────────────────────────────
   Motion variants — durations follow Material/HIG standards
   (150–300ms micro, ≤400ms complex; exit ~60–70% of enter).
   Reduced motion handled via <MotionConfig reducedMotion="user">.
   ────────────────────────────────────────────────────────────── */

const SPRING: Transition = { type: 'spring', stiffness: 380, damping: 30 };
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const HERO_STAGGER: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const FADE_UP_SOFT: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

const TRUST_LIST: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.4 } },
};

const TRUST_ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

const MODAL_BACKDROP: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const MODAL_CARD: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15, ease: EASE_OUT } },
};

const STATS_STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const SECTION_STAGGER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const VIEWPORT_ONCE = { once: true, amount: 0.3 } as const;

type PageState =
  | { step: 'idle' }
  | { step: 'email_modal'; leadId: string; website: string }
  | { step: 'analyzing'; leadId: string; website: string }
  | { step: 'register_modal'; leadId: string; website: string }
  | { step: 'result'; leadId: string; website: string };

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractDomain(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

export function QuickStartPage() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [pageState, setPageState] = useState<PageState>({ step: 'idle' });

  useSeo({
    title: 'AI Visibility Quick Start · See What ChatGPT, Claude, Gemini & Grok Say About You',
    description:
      'Drop your domain and get an instant AI visibility snapshot — see what ChatGPT, Claude, Gemini and Grok say about your brand, which competitors they recommend, and where you are missing from the answer.',
    canonical: `${SITE_URL}/start`,
    robots: 'index,follow',
    og: { type: 'website', siteName: 'Ainalytics', image: `${SITE_URL}/landing-hero.png` },
    jsonLd: [
      breadcrumbList([
        { name: 'Ainalytics', url: SITE_URL },
        { name: 'AI Visibility Quick Start', url: `${SITE_URL}/start` },
      ]),
    ],
  });

  // URL form
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [submittingUrl, setSubmittingUrl] = useState(false);

  useEffect(() => {
    trackPageView('/start');
    trackActivity({ event_type: 'quickstart', event_action: 'viewed' });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError('');
    const normalized = normalizeUrl(url);
    if (!normalized || !URL_REGEX.test(normalized)) {
      setUrlError(t('quickstart.errors.invalidUrl'));
      return;
    }
    setSubmittingUrl(true);
    try {
      const recaptcha_token = await executeRecaptchaForPublicAction('interest_lead');
      const res = await fetch(`${EDGE_FUNCTION_BASE}/interest-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          website: normalized,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          page_url: window.location.href,
          recaptcha_token,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Request failed');
      }
      const json = await res.json();
      const leadId = json?.data?.id as string | undefined;
      if (!leadId) throw new Error('Lead id missing in response');

      trackActivity({
        event_type: 'quickstart',
        event_action: 'website_submitted',
        metadata: { website: normalized },
      });

      setPageState({ step: 'email_modal', leadId, website: normalized });
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmittingUrl(false);
    }
  }, [url, t]);

  const handleEmailSubmit = useCallback(async (email: string) => {
    if (pageState.step !== 'email_modal') return;
    const recaptcha_token = await executeRecaptchaForPublicAction('interest_lead');
    const res = await fetch(`${EDGE_FUNCTION_BASE}/interest-leads/${pageState.leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, recaptcha_token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || 'Request failed');
    }
    trackActivity({ event_type: 'quickstart', event_action: 'email_submitted' });
    setPageState({ step: 'analyzing', leadId: pageState.leadId, website: pageState.website });
  }, [pageState]);

  // After entering analyzing, simulate scraping then move to register modal
  useEffect(() => {
    if (pageState.step !== 'analyzing') return;
    const timer = setTimeout(() => {
      setPageState((prev) =>
        prev.step === 'analyzing'
          ? { step: 'register_modal', leadId: prev.leadId, website: prev.website }
          : prev,
      );
    }, ANALYZING_DURATION_MS);
    return () => clearTimeout(timer);
  }, [pageState.step]);

  const handleRegisterSubmit = useCallback(async (data: {
    name: string;
    phone: string;
    company: string;
    job_role: string;
  }) => {
    if (pageState.step !== 'register_modal') return;
    const recaptcha_token = await executeRecaptchaForPublicAction('interest_lead');
    const res = await fetch(`${EDGE_FUNCTION_BASE}/interest-leads/${pageState.leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ ...data, recaptcha_token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || 'Request failed');
    }
    trackActivity({ event_type: 'quickstart', event_action: 'registration_completed' });
    setPageState({ step: 'result', leadId: pageState.leadId, website: pageState.website });
  }, [pageState]);

  const onChangeUrl = useCallback((v: string) => { setUrl(v); setUrlError(''); }, []);

  /* Analyzing overlay takes over the full screen */
  if (pageState.step === 'analyzing') {
    return <AnalyzingOverlay domain={extractDomain(pageState.website)} visible={true} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page quickstart-page">
        <LandingHeader scrolled={scrolled} />

        <main>
          {/* ─── Hero ─── */}
          <section className="landing-hero quickstart-hero" aria-labelledby="qs-hero-title">
            <div className="landing-hero-bg" />
            <HeroDecoration />

            <motion.div
              className="landing-container landing-hero-content quickstart-hero-content"
              variants={HERO_STAGGER}
              initial="hidden"
              animate="visible"
            >
              <motion.h1 id="qs-hero-title" className="landing-hero-title" variants={FADE_UP}>
                {t('quickstart.heroTitle')}{' '}
                <span className="landing-gradient-text quickstart-gradient-shift">
                  {t('quickstart.heroTitleHighlight')}
                </span>
              </motion.h1>

              <motion.p className="landing-hero-subtitle" variants={FADE_UP}>
                {t('quickstart.heroSubtitle')}
              </motion.p>

              <motion.div variants={FADE_UP} className="quickstart-hero-form-wrap">
                <UrlInputForm
                  url={url}
                  onChange={onChangeUrl}
                  onSubmit={handleUrlSubmit}
                  submitting={submittingUrl}
                  error={urlError}
                  autoFocus
                />
              </motion.div>

              <motion.ul
                className="quickstart-trust-points"
                variants={TRUST_LIST}
                aria-label="Highlights"
              >
                {[t('quickstart.trust1'), t('quickstart.trust2'), t('quickstart.trust3')].map((label) => (
                  <motion.li key={label} variants={TRUST_ITEM}>
                    <CheckCircle className="w-4 h-4" /> {label}
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>
          </section>

          <LogoBarSection />
          <ScoreShowcaseSection />
          <ProcessSection />
          <FeaturesSection />
          <DashboardPreviewSection />
          <FinalCtaSection
            url={url}
            onChange={onChangeUrl}
            onSubmit={handleUrlSubmit}
            submitting={submittingUrl}
            error={urlError}
          />

          {/* ─── Result (post-registration) ─── */}
          <AnimatePresence>
            {pageState.step === 'result' && (
              <ResultSection website={pageState.website} />
            )}
          </AnimatePresence>
        </main>

        <Suspense fallback={<div className="h-64 skeleton" />}>
          <LandingFooter />
        </Suspense>

        {/* ─── Modals ─── */}
        <AnimatePresence>
          {pageState.step === 'email_modal' && (
            <EmailModal
              website={pageState.website}
              onClose={() => setPageState({ step: 'idle' })}
              onSubmit={handleEmailSubmit}
            />
          )}
          {pageState.step === 'register_modal' && (
            <RegisterModal onSubmit={handleRegisterSubmit} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/* ────────────────────────────────────────────────────────────
   Animated hero decoration — drawing SVG paths + floating orbs.
   ──────────────────────────────────────────────────────────── */

function HeroDecoration() {
  return (
    <div className="quickstart-hero-decor" aria-hidden="true">
      <svg
        className="quickstart-hero-svg"
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="qs-line-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fd79a8" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="qs-line-grad-2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a29bfe" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <motion.path
          d="M -40 130 Q 220 60, 420 220 T 820 180 T 1240 280"
          stroke="url(#qs-line-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.2 }}
        />
        <motion.path
          d="M 1240 460 Q 980 540, 760 400 T 380 460 T -40 360"
          stroke="url(#qs-line-grad-2)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          transition={{ duration: 1.8, ease: 'easeInOut', delay: 0.5 }}
        />
      </svg>
      <motion.span
        className="quickstart-hero-orb quickstart-hero-orb--a"
        animate={{ y: [0, -14, 0], x: [0, 6, 0] }}
        transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
      />
      <motion.span
        className="quickstart-hero-orb quickstart-hero-orb--b"
        animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
        transition={{ duration: 11, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Reusable URL form (used in hero + final CTA)
   ──────────────────────────────────────────────────────────── */

interface UrlInputFormProps {
  url: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
  autoFocus?: boolean;
}

function UrlInputForm({ url, onChange, onSubmit, submitting, error, autoFocus }: UrlInputFormProps) {
  const { t } = useTranslation();
  return (
    <form onSubmit={onSubmit} className="quickstart-url-form">
      <UrlPill
        url={url}
        onChange={onChange}
        submitting={submitting}
        ctaLabel={t('quickstart.urlCta')}
        placeholder={t('quickstart.urlPlaceholder')}
        invalid={!!error}
        autoFocus={autoFocus}
      />
      <AnimatePresence>
        {error && (
          <motion.div
            className="quickstart-url-error"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <AlertCircle className="w-4 h-4" /> {error}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="quickstart-url-hint">{t('quickstart.urlHint')}</p>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────
   URL pill — entrance, focus glow, and pulsing submit CTA.
   ──────────────────────────────────────────────────────────── */

interface UrlPillProps {
  url: string;
  onChange: (v: string) => void;
  submitting: boolean;
  ctaLabel: string;
  placeholder: string;
  invalid: boolean;
  autoFocus?: boolean;
}

function UrlPill({ url, onChange, submitting, ctaLabel, placeholder, invalid, autoFocus }: UrlPillProps) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);

  const pillStyle = useMemo(() => {
    if (reduceMotion) return undefined;
    return focused ? { scale: 1.012 } : { scale: 1 };
  }, [focused, reduceMotion]);

  return (
    <motion.div
      className={`quickstart-url-input-wrap${focused ? ' is-focused' : ''}`}
      animate={pillStyle}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Globe className="quickstart-url-icon" aria-hidden="true" />
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="quickstart-url-input"
        autoFocus={autoFocus}
        required
        aria-invalid={invalid}
        aria-label={placeholder}
      />
      <motion.button
        type="submit"
        className="btn btn-primary quickstart-url-submit"
        disabled={submitting}
        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        {submitting ? (
          <span className="auth-spinner" />
        ) : (
          <>
            {ctaLabel}
            <motion.span
              aria-hidden="true"
              animate={reduceMotion ? undefined : { x: [0, 3, 0] }}
              transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
              style={{ display: 'inline-flex' }}
            >
              <ArrowRight className="w-4 h-4" />
            </motion.span>
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Logo bar — subtle floating AI platform names
   ──────────────────────────────────────────────────────────── */

function LogoBarSection() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      className="landing-logos quickstart-logos"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      aria-labelledby="qs-logos-title"
    >
      <div className="landing-container">
        <p id="qs-logos-title" className="landing-logos-title">
          {t('quickstart.logoBar.title')}
        </p>
        <ul className="landing-logos-grid quickstart-logos-grid">
          {AI_PLATFORMS.map((name, idx) => (
            <motion.li
              key={name}
              className="landing-logo-item quickstart-logo-item"
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -3, 0] }
              }
              transition={{
                duration: 4 + idx * 0.4,
                ease: 'easeInOut',
                repeat: Infinity,
                delay: idx * 0.2,
              }}
            >
              {name}
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}

/* ────────────────────────────────────────────────────────────
   Score showcase — animated GEO ring, count-up, factor bars
   ──────────────────────────────────────────────────────────── */

const SAMPLE_SCORE = 78;
const SAMPLE_FACTORS = [
  { key: 'factorTechnical', value: 88, color: '#28A745' },
  { key: 'factorContent', value: 74, color: '#FFC107' },
  { key: 'factorAuthority', value: 62, color: '#FFC107' },
  { key: 'factorSemantic', value: 91, color: '#00cec9' },
] as const;

function ScoreShowcaseSection() {
  const { t } = useTranslation();
  return (
    <motion.section
      className="landing-section landing-section-alt quickstart-score-section"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={SECTION_STAGGER}
      aria-labelledby="qs-score-title"
    >
      <div className="landing-container">
        <motion.div className="landing-section-header" variants={FADE_UP}>
          <h2 id="qs-score-title">
            {t('quickstart.score.titleStart')}
            <span className="landing-gradient-text">{t('quickstart.score.titleHighlight')}</span>
            {t('quickstart.score.titleEnd')}
          </h2>
          <p>{t('quickstart.score.subtitle')}</p>
        </motion.div>

        <motion.div className="quickstart-score-card glass-card" variants={FADE_UP}>
          <div className="quickstart-score-ring-wrap">
            <ScoreRing score={SAMPLE_SCORE} />
            <div className="quickstart-score-ring-meta">
              <span className="quickstart-score-readiness">
                <Sparkles className="w-3.5 h-3.5" /> {t('quickstart.score.readinessValue')}
              </span>
              <span className="quickstart-score-label">{t('quickstart.score.scoreLabel')}</span>
            </div>
          </div>

          <div className="quickstart-score-factors">
            {SAMPLE_FACTORS.map((f, i) => (
              <FactorBar
                key={f.key}
                label={t(`quickstart.score.${f.key}`)}
                value={f.value}
                color={f.color}
                delay={i * 0.08}
              />
            ))}
            <p className="quickstart-score-note">* {t('quickstart.score.exampleNote')}</p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - score / 100);

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      count.set(score);
      return;
    }
    const controls = animate(count, score, { duration: 1.6, ease: 'easeOut' });
    return controls.stop;
  }, [inView, score, count, reduceMotion]);

  return (
    <svg
      ref={ref}
      className="quickstart-score-ring"
      viewBox="0 0 160 160"
      width="160"
      height="160"
      role="img"
      aria-label={`GEO Score ${score} of 100`}
    >
      <defs>
        <linearGradient id="qs-ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6c5ce7" />
          <stop offset="100%" stopColor="#fd79a8" />
        </linearGradient>
      </defs>
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="rgba(108, 92, 231, 0.18)"
        strokeWidth="12"
      />
      <motion.circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="url(#qs-ring-grad)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={inView ? { strokeDashoffset: targetOffset } : undefined}
        transition={{ duration: 1.6, ease: 'easeOut' }}
        transform="rotate(-90 80 80)"
      />
      <motion.text
        x="80"
        y="80"
        textAnchor="middle"
        dominantBaseline="central"
        className="quickstart-score-ring-text"
      >
        {rounded}
      </motion.text>
    </svg>
  );
}

function FactorBar({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  return (
    <div className="quickstart-factor">
      <div className="quickstart-factor-row">
        <span className="quickstart-factor-label">{label}</span>
        <span className="quickstart-factor-value">{value}</span>
      </div>
      <div className="quickstart-factor-track">
        <motion.span
          className="quickstart-factor-fill"
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Three-step process
   ──────────────────────────────────────────────────────────── */

const PROCESS_STEPS = [
  { key: 'step1', icon: Globe },
  { key: 'step2', icon: Brain },
  { key: 'step3', icon: Compass },
] as const;

function ProcessSection() {
  const { t } = useTranslation();
  return (
    <motion.section
      className="landing-section quickstart-process-section"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={SECTION_STAGGER}
      aria-labelledby="qs-process-title"
    >
      <div className="landing-container">
        <motion.div className="landing-section-header" variants={FADE_UP}>
          <h2 id="qs-process-title">
            {t('quickstart.process.titleStart')}
            <span className="landing-gradient-text">{t('quickstart.process.titleHighlight')}</span>
          </h2>
          <p>{t('quickstart.process.subtitle')}</p>
        </motion.div>

        <ol className="quickstart-process-grid" aria-label="Process steps">
          {PROCESS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.key}
                className="quickstart-process-card glass-card"
                variants={FADE_UP}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <span className="quickstart-process-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="quickstart-process-icon">
                  <Icon className="w-6 h-6" />
                </span>
                <h3>{t(`quickstart.process.${step.key}Title`)}</h3>
                <p>{t(`quickstart.process.${step.key}Desc`)}</p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </motion.section>
  );
}

/* ────────────────────────────────────────────────────────────
   Features grid (6 cards)
   ──────────────────────────────────────────────────────────── */

const FEATURE_KEYS = [
  { key: 'f1', icon: Network },
  { key: 'f2', icon: Quote },
  { key: 'f3', icon: BarChart3 },
  { key: 'f4', icon: Zap },
  { key: 'f5', icon: Activity },
  { key: 'f6', icon: Users },
] as const;

function FeaturesSection() {
  const { t } = useTranslation();
  return (
    <motion.section
      className="landing-section landing-section-alt quickstart-features-section"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={SECTION_STAGGER}
      aria-labelledby="qs-features-title"
    >
      <div className="landing-container">
        <motion.div className="landing-section-header" variants={FADE_UP}>
          <h2 id="qs-features-title">
            {t('quickstart.featuresSection.titleStart')}
            <span className="landing-gradient-text">{t('quickstart.featuresSection.titleHighlight')}</span>
          </h2>
          <p>{t('quickstart.featuresSection.subtitle')}</p>
        </motion.div>

        <div className="quickstart-features-grid">
          {FEATURE_KEYS.map((f) => {
            const Icon = f.icon;
            return (
              <motion.article
                key={f.key}
                className="quickstart-feature-card glass-card"
                variants={FADE_UP_SOFT}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              >
                <span className="quickstart-feature-icon">
                  <Icon className="w-5 h-5" />
                </span>
                <h3>{t(`quickstart.featuresSection.${f.key}Title`)}</h3>
                <p>{t(`quickstart.featuresSection.${f.key}Desc`)}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

/* ────────────────────────────────────────────────────────────
   Dashboard preview — mock cockpit with metrics + sparkline
   ──────────────────────────────────────────────────────────── */

function DashboardPreviewSection() {
  const { t } = useTranslation();
  return (
    <motion.section
      className="landing-section quickstart-dashboard-section"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={SECTION_STAGGER}
      aria-labelledby="qs-dashboard-title"
    >
      <div className="landing-container">
        <motion.div className="landing-section-header" variants={FADE_UP}>
          <h2 id="qs-dashboard-title">
            {t('quickstart.dashboardPreview.titleStart')}
            <span className="landing-gradient-text">{t('quickstart.dashboardPreview.titleHighlight')}</span>
          </h2>
          <p>{t('quickstart.dashboardPreview.subtitle')}</p>
        </motion.div>

        <motion.div className="quickstart-dashboard-mock glass-card" variants={FADE_UP}>
          <div className="quickstart-dashboard-titlebar">
            <span className="quickstart-dashboard-dot quickstart-dashboard-dot--r" />
            <span className="quickstart-dashboard-dot quickstart-dashboard-dot--y" />
            <span className="quickstart-dashboard-dot quickstart-dashboard-dot--g" />
            <span className="quickstart-dashboard-titlebar-bar" />
          </div>

          <div className="quickstart-dashboard-body">
            <div className="quickstart-dashboard-metrics">
              <DashboardMetric
                label={t('quickstart.dashboardPreview.metric1Label')}
                target={1247}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <DashboardMetric
                label={t('quickstart.dashboardPreview.metric2Label')}
                target={78}
                icon={<BarChart3 className="w-4 h-4" />}
              />
              <DashboardMetric
                label={t('quickstart.dashboardPreview.metric3Label')}
                target={92}
                icon={<Quote className="w-4 h-4" />}
              />
            </div>

            <div className="quickstart-dashboard-chart">
              <span className="quickstart-dashboard-chart-label">
                {t('quickstart.dashboardPreview.trendLabel')}
              </span>
              <Sparkline />
            </div>

            <div className="quickstart-dashboard-sentiment">
              <span className="quickstart-dashboard-chart-label">
                {t('quickstart.dashboardPreview.sentimentLabel')}
              </span>
              <div className="quickstart-sentiment-row">
                <SentimentBar
                  label={t('quickstart.dashboardPreview.sentimentPositive')}
                  value={68}
                  variant="positive"
                />
                <SentimentBar
                  label={t('quickstart.dashboardPreview.sentimentNeutral')}
                  value={32}
                  variant="neutral"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function DashboardMetric({ label, target, icon }: { label: string; target: number; icon: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(0);
  const formatted = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      count.set(target);
      return;
    }
    const controls = animate(count, target, { duration: 1.4, ease: 'easeOut' });
    return controls.stop;
  }, [inView, target, count, reduceMotion]);

  return (
    <div ref={ref} className="quickstart-dashboard-metric">
      <span className="quickstart-dashboard-metric-icon">{icon}</span>
      <span className="quickstart-dashboard-metric-label">{label}</span>
      <motion.span className="quickstart-dashboard-metric-value">{formatted}</motion.span>
    </div>
  );
}

function Sparkline() {
  // Pre-defined points for a realistic-looking trend
  const points = [
    [0, 38], [12, 44], [24, 36], [36, 50], [48, 46],
    [60, 58], [72, 52], [84, 64], [96, 60], [108, 70],
    [120, 66], [132, 78], [144, 74], [156, 82], [168, 78],
    [180, 88],
  ];
  const path = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`), '');
  const area = `${path} L 180 100 L 0 100 Z`;

  return (
    <svg className="quickstart-sparkline" viewBox="0 0 180 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="qs-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#qs-spark-grad)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="url(#qs-ring-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.1 }}
      />
    </svg>
  );
}

function SentimentBar({ label, value, variant }: { label: string; value: number; variant: 'positive' | 'neutral' }) {
  const color = variant === 'positive' ? '#28A745' : '#a29bfe';
  return (
    <div className="quickstart-sentiment-item">
      <div className="quickstart-sentiment-row-top">
        <span className="quickstart-sentiment-label">{label}</span>
        <span className="quickstart-sentiment-value">{value}%</span>
      </div>
      <div className="quickstart-factor-track">
        <motion.span
          className="quickstart-factor-fill"
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Final CTA — repeats the URL pill with a stronger frame
   ──────────────────────────────────────────────────────────── */

interface FinalCtaSectionProps {
  url: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
}

function FinalCtaSection({ url, onChange, onSubmit, submitting, error }: FinalCtaSectionProps) {
  const { t } = useTranslation();
  return (
    <motion.section
      className="quickstart-final-cta"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT_ONCE}
      variants={SECTION_STAGGER}
      aria-labelledby="qs-final-title"
    >
      <div className="quickstart-final-cta-bg" aria-hidden="true" />
      <div className="landing-container quickstart-final-cta-inner">
        <motion.h2 id="qs-final-title" variants={FADE_UP} className="quickstart-final-cta-title">
          {t('quickstart.finalCta.title')}
        </motion.h2>
        <motion.p variants={FADE_UP} className="quickstart-final-cta-subtitle">
          {t('quickstart.finalCta.subtitle')}
        </motion.p>
        <motion.div variants={FADE_UP} className="quickstart-final-cta-form">
          <UrlInputForm
            url={url}
            onChange={onChange}
            onSubmit={onSubmit}
            submitting={submitting}
            error={error}
          />
        </motion.div>
        <motion.span variants={FADE_UP_SOFT} className="quickstart-final-cta-note">
          <CheckCircle className="w-4 h-4" /> {t('quickstart.finalCta.note')}
        </motion.span>
      </div>
    </motion.section>
  );
}

/* ────────────────────────────────────────────────────────────
   Email Modal — first progressive step
   ──────────────────────────────────────────────────────────── */

interface EmailModalProps {
  website: string;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}

function EmailModal({ website, onClose, onSubmit }: EmailModalProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useScrollLock(true);

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(t('quickstart.errors.invalidEmail'));
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setSubmitting(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <motion.div
      ref={overlayRef}
      className="interest-modal-overlay"
      onClick={handleOverlayClick}
      variants={MODAL_BACKDROP}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qs-email-title"
    >
      <motion.div
        className="interest-modal glass-card quickstart-modal"
        variants={MODAL_CARD}
      >
        <div className="interest-modal-header">
          <div>
            <h2 id="qs-email-title" className="interest-modal-title">
              {t('quickstart.emailModal.title')}
            </h2>
            <p className="interest-modal-subtitle">
              {t('quickstart.emailModal.subtitle', { domain: extractDomain(website) })}
            </p>
          </div>
          <button
            className="interest-modal-close"
            onClick={onClose}
            aria-label={t('quickstart.emailModal.close', { defaultValue: 'Close' })}
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="interest-modal-form">
          <AnimatePresence>
            {error && (
              <motion.div
                className="interest-modal-error"
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="interest-field">
            <label htmlFor="qs-email">
              {t('quickstart.emailModal.label')} <span className="text-error">*</span>
            </label>
            <div className="auth-input-wrap">
              <Mail className="auth-input-icon" />
              <input
                id="qs-email"
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder={t('quickstart.emailModal.placeholder')}
                required
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          <motion.button
            type="submit"
            className="btn btn-primary w-full"
            disabled={submitting || !email.trim()}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {submitting ? (
              <span className="auth-spinner" />
            ) : (
              <>
                {t('quickstart.emailModal.submit')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
          <p className="quickstart-modal-note">{t('quickstart.emailModal.note')}</p>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Registration Modal — final step before result
   ──────────────────────────────────────────────────────────── */

interface RegisterModalProps {
  onSubmit: (data: { name: string; phone: string; company: string; job_role: string }) => Promise<void>;
}

function RegisterModal({ onSubmit }: RegisterModalProps) {
  const { t, i18n } = useTranslation();
  useScrollLock(true);

  const nameRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const phoneOk = getPhoneDigitCount(phone) >= MIN_PHONE_DIGITS;
  const isValid = name.trim() && phoneOk && company.trim() && jobRole.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(t('quickstart.errors.nameRequired'));
      nameRef.current?.focus();
      return;
    }
    if (!phoneOk) {
      setError(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
      return;
    }
    if (!company.trim()) {
      setError(t('quickstart.errors.companyRequired'));
      companyRef.current?.focus();
      return;
    }
    if (!jobRole.trim()) {
      setError(t('quickstart.errors.jobRoleRequired'));
      roleRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        company: company.trim(),
        job_role: jobRole.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="interest-modal-overlay"
      variants={MODAL_BACKDROP}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qs-register-title"
    >
      <motion.div
        className="interest-modal glass-card quickstart-modal"
        variants={MODAL_CARD}
      >
        <div className="interest-modal-header">
          <div>
            <h2 id="qs-register-title" className="interest-modal-title">
              {t('quickstart.registerModal.title')}
            </h2>
            <p className="interest-modal-subtitle">{t('quickstart.registerModal.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="interest-modal-form">
          <AnimatePresence>
            {error && (
              <motion.div
                className="interest-modal-error"
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="interest-field">
            <label htmlFor="qs-name">
              {t('quickstart.registerModal.name')} <span className="text-error">*</span>
            </label>
            <div className="auth-input-wrap">
              <User className="auth-input-icon" />
              <input
                id="qs-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('quickstart.registerModal.namePlaceholder')}
                required
                autoFocus
                autoComplete="name"
              />
            </div>
          </div>

          <div className="interest-field">
            <label htmlFor="qs-phone">
              {t('quickstart.registerModal.phone')} <span className="text-error">*</span>
            </label>
            <PhoneInput
              id="qs-phone"
              value={phone}
              onChange={setPhone}
              defaultCountry={LANGUAGE_COUNTRY_MAP[i18n.language] || 'auto'}
              placeholder={t('quickstart.registerModal.phonePlaceholder')}
              required
            />
          </div>

          <div className="interest-field">
            <label htmlFor="qs-company">
              {t('quickstart.registerModal.company')} <span className="text-error">*</span>
            </label>
            <div className="auth-input-wrap">
              <Building2 className="auth-input-icon" />
              <input
                id="qs-company"
                ref={companyRef}
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('quickstart.registerModal.companyPlaceholder')}
                required
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="interest-field">
            <label htmlFor="qs-role">
              {t('quickstart.registerModal.jobRole')} <span className="text-error">*</span>
            </label>
            <div className="auth-input-wrap">
              <Briefcase className="auth-input-icon" />
              <input
                id="qs-role"
                ref={roleRef}
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder={t('quickstart.registerModal.jobRolePlaceholder')}
                required
                autoComplete="organization-title"
              />
            </div>
          </div>

          <motion.button
            type="submit"
            className="btn btn-primary w-full"
            disabled={!isValid || submitting}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {submitting ? (
              <span className="auth-spinner" />
            ) : (
              <>
                {t('quickstart.registerModal.submit')}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
          <p className="quickstart-modal-note">{t('quickstart.registerModal.note')}</p>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   Result section — teaser + CTA to /signup
   ──────────────────────────────────────────────────────────── */

function ResultSection({ website }: { website: string }) {
  const { t } = useTranslation();
  const domain = extractDomain(website);

  useEffect(() => {
    const el = document.getElementById('quickstart-result');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const stats = [
    t('quickstart.result.statGeoLabel'),
    t('quickstart.result.statMentionsLabel'),
    t('quickstart.result.statSourcesLabel'),
  ];

  return (
    <motion.section
      id="quickstart-result"
      className="landing-section quickstart-result-section"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0 }}
      variants={STATS_STAGGER}
    >
      <div className="landing-container">
        <motion.div className="quickstart-result-card glass-card" variants={FADE_UP}>
          <motion.div
            className="quickstart-result-success"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.05 }}
          >
            <CheckCircle className="w-12 h-12 text-success" />
          </motion.div>

          <motion.h2 className="quickstart-result-title" variants={FADE_UP_SOFT}>
            {t('quickstart.result.title')}
          </motion.h2>
          <motion.p className="quickstart-result-subtitle" variants={FADE_UP_SOFT}>
            {t('quickstart.result.subtitle', { domain })}
          </motion.p>

          <motion.div
            className="quickstart-result-stats"
            variants={STATS_STAGGER}
            initial="hidden"
            animate="visible"
          >
            {stats.map((label) => (
              <motion.div
                key={label}
                className="quickstart-stat"
                variants={FADE_UP_SOFT}
              >
                <span className="quickstart-stat-label">{label}</span>
                <span className="quickstart-stat-value quickstart-stat-blur" aria-hidden="true">
                  --
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="quickstart-result-cta" variants={FADE_UP_SOFT}>
            <Link
              to="/signup"
              className="btn btn-primary btn-lg"
              onClick={() => trackCTAClick('quickstart_result_signup', '/start')}
            >
              {t('quickstart.result.cta')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="quickstart-result-cta-note">
              {t('quickstart.result.ctaNote', { app: APP_NAME })}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}
