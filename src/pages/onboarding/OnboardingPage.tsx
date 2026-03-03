import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Bot,
  FolderOpen,
  BarChart3,
  Search,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Radar,
  Shield,
  FileText,
  Zap,
  Target,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Building2,
  HelpCircle,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiClient } from '@/lib/api';
import { LOCALES } from '@/lib/constants';
import { suggestCompanyNameFromDomain } from '@/lib/email';
import { extractRootDomain } from '@/lib/domain';
import type { GeoFactorScore, GeoCategoryScores, GeoReadinessLevel, GeoNextLevel, GeoTopRecommendation } from '@/types';

// ─── Pre-analyze response type ──────────────────────────────
interface PreAnalyzeResult {
  domain: string;
  website_title: string | null;
  meta_description: string | null;
  language: string | null;
  og_image: string | null;
  robots_txt: boolean;
  sitemap_xml: boolean;
  llms_txt: boolean;
  geo_score: number;
  readiness_level: GeoReadinessLevel;
  readiness_label: string;
  category_scores: GeoCategoryScores;
  points_to_next_level: number;
  next_level: GeoNextLevel | null;
  factor_scores: GeoFactorScore[];
  top_recommendations: GeoTopRecommendation[];
}

// ─── Step config ────────────────────────────────────────────
const STEPS = [
  { key: 'company', icon: Globe, color: 'from-emerald-500 to-teal-600' },
  { key: 'models', icon: Bot, color: 'from-violet-500 to-purple-600' },
  { key: 'categories_prompts', icon: FolderOpen, color: 'from-amber-500 to-orange-600' },
  { key: 'results', icon: BarChart3, color: 'from-cyan-500 to-blue-600' },
] as const;

// ─── Public email domains to skip for auto-fill ─────────────
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'protonmail.com', 'icloud.com', 'mail.com', 'zoho.com',
]);

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

function getEmailDomain(email: string | undefined): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || PUBLIC_DOMAINS.has(domain)) return null;
  return domain;
}

// ─── Category color map ─────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  technical: '#6c5ce7',
  content: '#fd79a8',
  authority: '#00cec9',
  semantic: '#ffeaa7',
};

const READINESS_BADGES: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Not Ready', color: 'text-error', bg: 'bg-error/10' },
  1: { label: 'Basic', color: 'text-error', bg: 'bg-error/10' },
  2: { label: 'Developing', color: 'text-warning', bg: 'bg-warning/10' },
  3: { label: 'Intermediate', color: 'text-warning', bg: 'bg-warning/10' },
  4: { label: 'Advanced', color: 'text-success', bg: 'bg-success/10' },
  5: { label: 'Expert', color: 'text-success', bg: 'bg-success/10' },
};

// ─── Main Component ─────────────────────────────────────────
export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { currentTenant, setHasCompany } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Redirect to company page if user already has a plan
  useEffect(() => {
    if (currentTenant?.plan_id) {
      navigate('/dashboard/company', { replace: true });
    }
  }, [currentTenant?.plan_id, navigate]);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PreAnalyzeResult | null>(null);
  const [error, setError] = useState('');
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const [companyExists, setCompanyExists] = useState(false);

  // Fetch company on mount — if it exists, jump to analyze step
  useEffect(() => {
    apiClient.get<any>('/company').then((res) => {
      if (res.data) {
        setCompanyExists(true);
        setHasCompany(true);
        setStep(STEPS.length);
        if (res.data.domain) {
          setDomain(res.data.domain);
          setCompanyName(res.data.company_name || suggestCompanyNameFromDomain(extractRootDomain(res.data.domain) || res.data.domain));
        }
      } else {
        // No company — auto-fill domain from email
        const emailDomain = getEmailDomain(profile?.email);
        if (emailDomain) {
          setDomain(emailDomain);
          setCompanyName(suggestCompanyNameFromDomain(extractRootDomain(emailDomain) || emailDomain));
        }
      }
    }).catch(() => {
      // No company — auto-fill domain from email
      const emailDomain = getEmailDomain(profile?.email);
      if (emailDomain) {
        setDomain(emailDomain);
        setCompanyName(suggestCompanyNameFromDomain(extractRootDomain(emailDomain) || emailDomain));
      }
    });
  }, [setHasCompany]);

  // Auto-derive company name when domain changes
  const handleDomainChange = useCallback((value: string) => {
    setDomain(value);
    const root = extractRootDomain(value) || value;
    if (root && root.includes('.')) {
      setCompanyName(suggestCompanyNameFromDomain(root));
    }
  }, []);

  const totalSteps = STEPS.length + 1; // 4 steps + analyze
  const isLastExplanationStep = step === STEPS.length - 1;
  const isAnalyzeStep = step === STEPS.length;

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection('next');
      setStep((s) => s + 1);
    }
  }, [step, totalSteps]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection('prev');
      setStep((s) => s - 1);
      if (result) setResult(null);
    }
  }, [step, result]);

  const skipToPlans = useCallback(async () => {
    try {
      await apiClient.put('/users-me', { has_seen_onboarding: true });
    } catch { /* ignore */ }
    navigate('/dashboard/plans', { replace: true });
  }, [navigate]);

  const handleAnalyze = useCallback(async () => {
    if (!domain.trim()) return;
    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      // Update or create company
      if (companyExists) {
        await apiClient.patch('/company', {
          domain: domain.trim(),
          company_name: companyName.trim() || null,
        });
      } else {
        await apiClient.post('/company', {
          domain: domain.trim(),
          description: '',
          target_language: 'en',
        });
        setHasCompany(true);
        setCompanyExists(true);
      }

      // Run pre-analyze for GEO preview
      const res = await apiClient.post<PreAnalyzeResult>('/scrape-company', {
        action: 'pre-analyze',
        domain: domain.trim(),
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setAnalyzing(false);
    }
  }, [domain, companyName, companyExists, t, setHasCompany]);

  const handleSubscribe = useCallback(async () => {
    try {
      await apiClient.put('/users-me', { has_seen_onboarding: true });
    } catch { /* ignore */ }
    navigate('/dashboard/plans', { replace: true });
  }, [navigate]);

  // ─── Render: Explanation Steps ────────────────────────────
  if (!isAnalyzeStep) {
    const currentStep = STEPS[step]!;
    const StepIcon = currentStep.icon;

    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={{
                background: i <= step
                  ? 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))'
                  : 'var(--glass-border)',
              }}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
            {t('onboarding.stepOf', { current: step + 1, total: totalSteps })}
          </span>
          <div className="flex items-center gap-3">
            <div className="locale-switcher" style={{ marginRight: 0 }}>
              {Object.values(LOCALES).map((lng) => (
                <button
                  key={lng}
                  className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                  onClick={() => i18n.changeLanguage(lng)}
                >
                  {LOCALE_LABELS[lng]}
                </button>
              ))}
            </div>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-glass-hover transition-colors text-text-muted hover:text-text-primary"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={skipToPlans}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              id="onboarding-skip-btn"
            >
              {t('onboarding.skip')}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div
          key={step}
          className={`flex-1 flex flex-col transition-all duration-500 ease-out ${
            direction === 'next' ? 'animate-in slide-in-from-right-5' : 'animate-in slide-in-from-left-5'
          }`}
        >
          {/* Hero section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-12 mb-8">
            {/* Decorative gradient blobs */}
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20"
              style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
            />
            <div
              className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-10"
              style={{ background: `linear-gradient(135deg, var(--brand-accent), var(--brand-primary))` }}
            />

            <div className="relative z-10 flex flex-col md:flex-row items-start gap-8">
              {/* Icon */}
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentStep.color} flex items-center justify-center shrink-0 shadow-lg`}>
                <StepIcon className="w-10 h-10 text-white" />
              </div>

              {/* Text */}
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
                  {t(`onboarding.steps.${currentStep.key}.title`)}
                </h1>
                <p className="text-base text-text-secondary leading-relaxed mb-4">
                  {t(`onboarding.steps.${currentStep.key}.description`)}
                </p>
                <p className="text-sm text-text-muted leading-relaxed">
                  {t(`onboarding.steps.${currentStep.key}.detail`)}
                </p>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((featureIdx) => {
              const FeatureIcons = [Target, Shield, Zap] as const;
              const FIcon = FeatureIcons[featureIdx]!;
              return (
                <div key={featureIdx} className="dashboard-card p-5 group hover:border-brand-primary/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-3 group-hover:bg-brand-primary/20 transition-colors">
                    <FIcon className="w-4.5 h-4.5 text-brand-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    {t(`onboarding.steps.${currentStep.key}.features.${featureIdx}.title`)}
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {t(`onboarding.steps.${currentStep.key}.features.${featureIdx}.desc`)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-glass-border">
          <button
            onClick={goPrev}
            disabled={step === 0}
            className="btn btn-ghost btn-sm"
            id="onboarding-prev-btn"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('common.back')}
          </button>

          <button
            onClick={goNext}
            className="btn btn-primary btn-sm"
            id="onboarding-next-btn"
          >
            {isLastExplanationStep ? t('onboarding.tryItNow') : t('onboarding.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Analyze Step ─────────────────────────────────
  return (
    <>
    <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-500"
            style={{
              background: i <= step
                ? 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))'
                : 'var(--glass-border)',
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {t('onboarding.stepOf', { current: step + 1, total: totalSteps })}
        </span>
        <div className="flex items-center gap-3">
          <div className="locale-switcher" style={{ marginRight: 0 }}>
            {Object.values(LOCALES).map((lng) => (
              <button
                key={lng}
                className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                onClick={() => i18n.changeLanguage(lng)}
              >
                {LOCALE_LABELS[lng]}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-glass-hover transition-colors text-text-muted hover:text-text-primary"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={skipToPlans} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
            {t('onboarding.skip')}
          </button>
        </div>
      </div>

      {result ? (
        /* ── GEO Preview ──────────────────────────────────── */
        <div key="result" className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Top hero: company info + quick checks */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-10 mb-6">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Company info */}
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">
                  {result.website_title || result.domain}
                </h2>
                <p className="text-sm text-text-muted mb-3">{result.domain}</p>

                {/* Readiness badge */}
                {(() => {
                  const badge = READINESS_BADGES[result.readiness_level] ?? READINESS_BADGES[0]!;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color} ${badge.bg}`}>
                      <Sparkles className="w-3 h-3" />
                      {result.readiness_label || badge.label}
                    </span>
                  );
                })()}

                {result.next_level && result.points_to_next_level > 0 && (
                  <p className="text-xs text-text-muted mt-2">
                    {t('onboarding.analyze.pointsToNext', {
                      points: result.points_to_next_level,
                      level: result.next_level.label,
                    })}
                  </p>
                )}
              </div>

              {/* Right: Quick checks */}
              <div className="space-y-2.5">
                {[
                  { label: 'robots.txt', has: result.robots_txt },
                  { label: 'sitemap.xml', has: result.sitemap_xml },
                  { label: 'llms.txt', has: result.llms_txt },
                ].map(({ label, has }) => (
                  <div key={label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-primary/30">
                    {has ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    )}
                    <span className="text-sm font-mono text-text-secondary">{label}</span>
                    <span className={`ml-auto text-xs font-medium ${has ? 'text-success' : 'text-warning'}`}>
                      {has ? t('common.found') : t('common.missing')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {t('onboarding.analyze.categoriesTitle')}
            </h3>
            <button
              onClick={() => setShowCategoryInfo(true)}
              className="p-1 rounded-lg hover:bg-glass-hover transition-colors text-text-muted hover:text-text-primary"
              title={t('onboarding.analyze.categoriesInfoTitle')}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Object.entries(result.category_scores).map(([cat, score]) => (
              <div key={cat} className="dashboard-card p-4 text-center">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-2"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] || '#6c5ce7' }}
                />
                <div className="text-lg font-bold text-text-primary">{Math.round(score as number)}</div>
                <div className="text-xs text-text-muted capitalize">{t(`onboarding.analyze.categories.${cat}`, cat)}</div>
              </div>
            ))}
          </div>

          {/* Improvements teaser */}
          {result.top_recommendations.length > 0 && (
            <div className="dashboard-card p-5 mb-6 text-center">
              <p className="text-lg font-bold text-brand-primary">
                +25 {t('onboarding.analyze.improvementsFound')}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-6 border-t border-glass-border flex items-center justify-between">
            <button
              onClick={handleSubscribe}
              className="btn btn-primary py-3 px-8 text-base font-semibold"
              id="onboarding-subscribe-btn"
            >
              {t('onboarding.analyze.subscribe')}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Domain Input ─────────────────────────────────── */
        <div key="input" className="flex-1 flex flex-col">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-12 mb-8">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-accent/10 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-5 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shrink-0 shadow-lg shadow-brand-primary/20">
                  <Radar className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                    {t('onboarding.analyze.title')}
                  </h1>
                  <p className="text-sm text-text-secondary mt-1">
                    {t('onboarding.analyze.subtitle')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-text-muted leading-relaxed mt-4">
                {t('onboarding.analyze.description')}
              </p>
            </div>
          </div>

          {/* Input card */}
          <div className="dashboard-card p-8 mb-8">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="kpi-label block mb-1.5">{t('company.domain')} *</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => handleDomainChange(e.target.value)}
                      placeholder={t('company.domainPlaceholder')}
                      className="input-field"
                      style={{ paddingLeft: '2.5rem' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
                      disabled={analyzing}
                      id="onboarding-domain-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="kpi-label block mb-1.5">{t('auth.orgName')}</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Inc."
                      className="input-field"
                      style={{ paddingLeft: '2.5rem' }}
                      disabled={analyzing}
                      id="onboarding-company-name-input"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={analyzing || !domain.trim()}
                className="btn btn-primary w-full py-3 text-base font-semibold"
                id="onboarding-analyze-btn"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('onboarding.analyze.analyzing')}
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    {t('onboarding.analyze.cta')}
                  </>
                )}
              </button>

              {analyzing && (
                <p className="text-xs text-text-muted text-center animate-pulse">
                  {t('onboarding.analyze.wait')}
                </p>
              )}
            </div>
          </div>

          {/* What we check */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { icon: FileText, label: t('onboarding.analyze.checks.robots') },
              { icon: Globe, label: t('onboarding.analyze.checks.sitemap') },
              { icon: Bot, label: t('onboarding.analyze.checks.llms') },
              { icon: Shield, label: t('onboarding.analyze.checks.homepage') },
            ].map(({ icon: CheckIcon, label }) => (
              <div key={label} className="dashboard-card p-3 flex items-center gap-2 text-xs text-text-secondary">
                <CheckIcon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                {label}
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-auto pt-6 border-t border-glass-border flex items-center justify-between">
            <button onClick={goPrev} className="btn btn-ghost btn-sm" id="onboarding-prev-analyze">
              <ChevronLeft className="w-4 h-4" />
              {t('common.back')}
            </button>
            <button onClick={skipToPlans} className="text-xs text-text-muted hover:text-text-secondary transition-colors">
              {t('onboarding.skipToPlans')}
            </button>
          </div>
        </div>
      )}
    </div>

      {/* Category Info Modal */}
      {showCategoryInfo && (
        <div className="interest-modal-overlay" onClick={() => setShowCategoryInfo(false)}>
          <div
            className="interest-modal"
            style={{ maxWidth: '800px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="interest-modal-header">
              <div>
                <h2 className="interest-modal-title">{t('onboarding.analyze.categoriesInfoTitle')}</h2>
                <p className="interest-modal-subtitle">{t('onboarding.analyze.categoriesInfoSubtitle')}</p>
              </div>
              <button className="interest-modal-close" onClick={() => setShowCategoryInfo(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="space-y-5">
                {(['technical', 'content', 'authority', 'semantic'] as const).map((cat) => (
                  <div key={cat} className="flex gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] || '#6c5ce7' }}
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-1">
                        {t(`onboarding.analyze.categories.${cat}`)}
                      </h4>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {t(`onboarding.analyze.categoryExplain.${cat}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/10">
                <p className="text-xs text-text-muted leading-relaxed italic">
                  {t('onboarding.analyze.categoryExplain.summary')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
