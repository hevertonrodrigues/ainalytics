import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Clock, AlertTriangle, Globe, Mail, Sparkles,
  BarChart3, Target, Shield, Zap, Eye, TrendingUp, ArrowLeft,
} from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useProposalData, formatCurrency, formatDate, SUPPORTED_LANGS } from './proposalShared';

const ADVANTAGE_ICONS = [BarChart3, Target, Shield, Zap, Eye, TrendingUp];

export function ProposalFullPage() {
  const { proposal, loading, notFound, lang, setLang, slug, c } = useProposalData();
  const { t } = useTranslation();

  // Auto-trigger print when ?print=1
  useEffect(() => {
    if (!proposal || loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1') {
      const timer = setTimeout(() => window.print(), 1500);
      return () => clearTimeout(timer);
    }
  }, [proposal, loading]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ background: '#0a0a0f' }} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 mx-auto" />
          <div className="w-48 h-4 bg-white/5 rounded mx-auto" />
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound || !proposal) {
    return (
      <div style={{ background: '#0a0a0f' }} className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="w-16 h-16 text-amber-400/60 mx-auto" />
          <h1 className="text-2xl font-bold text-white">{t('proposal.public.notFound')}</h1>
          <p className="text-white/50">{t('proposal.public.notFoundDesc')}</p>
        </div>
      </div>
    );
  }

  const isExpired = proposal.status === 'expired';
  const features = proposal.custom_features[lang] || proposal.custom_features['en'] || [];
  const description = proposal.custom_description[lang] || proposal.custom_description['en'] || '';
  const contactEmail = `contact@${proposal.company_domain || 'ainalytics.com'}`;

  const advantages: string[] = (t('proposal.full.advantages', { returnObjects: true }) as string[]) || [];
  const advantageDescs: string[] = (t('proposal.full.advantageDescs', { returnObjects: true }) as string[]) || [];
  const solutionItems: string[] = (t('proposal.full.solutionItems', { returnObjects: true }) as string[]) || [];


  return (
    <div style={{ background: c.bg }} className="min-h-screen relative overflow-hidden" id="proposal-full-content">
      {/* Background ambient */}
      <div style={{ background: c.glow1 }} className="absolute top-[-200px] right-[-200px] w-[700px] h-[700px] rounded-full blur-[150px] pointer-events-none" />
      <div style={{ background: c.glow2 }} className="absolute bottom-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" />

      {/* Language switcher */}
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <div style={{ background: c.card, border: `1px solid ${c.border}` }} className="flex items-center gap-1 backdrop-blur-md rounded-lg p-1">
          <Globe className="w-3.5 h-3.5 ml-2" style={{ color: c.textMuted }} />
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-2 py-1 rounded-md text-xs font-medium uppercase transition-colors"
              style={{
                background: lang === l ? c.badge : 'transparent',
                color: lang === l ? c.badgeText : c.textMuted,
              }}
            >
              {l === 'pt-br' ? 'PT' : l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Back to simple */}
      <div className="fixed top-4 left-4 z-50 print:hidden">
        <Link
          to={`/proposal/${slug}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md text-xs font-medium transition-colors"
          style={{ background: c.card, border: `1px solid ${c.border}`, color: c.textMuted }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('proposal.full.backToSimple')}
        </Link>
      </div>

      <div className="relative max-w-4xl mx-auto px-6">

        {/* ── SECTION 1 — COVER ── */}
        <section className="min-h-[80vh] flex flex-col items-center justify-center text-center py-20">
          <div className="inline-flex items-center gap-3 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight" style={{ color: c.text }}>{APP_NAME}</span>
          </div>

          <span
            className="inline-flex items-center px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[.2em] mb-8"
            style={{ background: c.badge, color: c.badgeText, border: `1px solid ${c.borderAccent}` }}
          >
            {t('proposal.public.customPlan')}
          </span>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl" style={{ color: c.text }}>
            {proposal.custom_plan_name}
          </h1>

          {(proposal.client_name || proposal.company_name) && (
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: c.badgeText, opacity: 0.6 }}>
                {t('proposal.public.preparedFor')}
              </p>
              <p className="text-xl font-medium" style={{ color: c.textSoft }}>{proposal.client_name || ''}</p>
              {proposal.company_name && proposal.client_name && (
                <p className="text-sm" style={{ color: c.textMuted }}>{proposal.company_name}</p>
              )}
              {proposal.company_name && !proposal.client_name && (
                <p className="text-xl font-medium" style={{ color: c.textSoft }}>{proposal.company_name}</p>
              )}
            </div>
          )}

          <p className="text-sm" style={{ color: c.textFaint }}>{formatDate(proposal.created_at, lang)}</p>

          <div className="mt-16 animate-bounce print:hidden">
            <div className="w-6 h-10 rounded-full flex items-start justify-center p-2" style={{ border: `2px solid ${c.border}` }}>
              <div className="w-1.5 h-2.5 rounded-full" style={{ background: c.textFaint }} />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="w-px h-20 mx-auto" style={{ background: `linear-gradient(to bottom, transparent, ${c.border}, transparent)` }} />

        {/* ── SECTION 2 — ABOUT US ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.full.aboutUsLabel')} c={c} />
          <div className="backdrop-blur-xl rounded-2xl p-8 md:p-12 max-w-3xl mx-auto" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <h2 className="text-3xl font-bold mb-6" style={{ color: c.text }}>{t('proposal.full.aboutUsTitle')}</h2>
            <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>
              {t('proposal.full.aboutUsText')}
            </p>
          </div>
        </section>

        {/* ── SECTION 3 — THE PROBLEM ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.full.problemLabel')} c={c} />
          <div className="backdrop-blur-xl rounded-2xl p-8 md:p-12 max-w-3xl mx-auto" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <h2 className="text-3xl font-bold mb-6" style={{ color: c.text }}>{t('proposal.full.problemTitle')}</h2>
            <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>
              {t('proposal.full.problemText')}
            </p>
          </div>
        </section>

        {/* ── SECTION 4 — OUR SOLUTION ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.full.solutionLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center" style={{ color: c.text }}>{t('proposal.full.solutionTitle')}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {solutionItems.map((item: string, idx: number) => {
                const Icon = ADVANTAGE_ICONS[idx % ADVANTAGE_ICONS.length] ?? Zap;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-4 p-5 rounded-xl transition-colors"
                    style={{ background: c.card, border: `1px solid ${c.border}` }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.badge }}>
                      <Icon className="w-5 h-5" style={{ color: c.badgeText }} />
                    </div>
                    <span className="text-sm leading-relaxed pt-2" style={{ color: c.textSoft }}>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 5 — COMPETITIVE ADVANTAGES ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.full.advantagesLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center" style={{ color: c.text }}>{t('proposal.full.advantagesTitle')}</h2>
            <div className="space-y-4">
              {advantages.map((adv: string, idx: number) => (
                <div key={idx} className="flex items-start gap-4 p-5 rounded-xl" style={{ background: c.card, border: `1px solid ${c.border}` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: c.success }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: c.successText }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm mb-1" style={{ color: c.text }}>{adv}</p>
                    {advantageDescs[idx] && (
                      <p className="text-xs leading-relaxed" style={{ color: c.textMuted }}>{advantageDescs[idx]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 6 — PLAN DETAILS ── */}
        {description && (
          <section className="py-20">
            <SectionHeader label={t('proposal.public.planDetails')} c={c} />
            <div className="backdrop-blur-xl rounded-2xl p-8 md:p-12 max-w-3xl mx-auto" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>{description}</p>
            </div>
          </section>
        )}

        {/* ── SECTION 7 — FEATURES INCLUDED ── */}
        {features.length > 0 && (
          <section className="py-20">
            <SectionHeader label={t('proposal.public.whatsIncluded')} c={c} />
            <div className="backdrop-blur-xl rounded-2xl p-8 md:p-12 max-w-3xl mx-auto" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="grid gap-4 md:grid-cols-2">
                {features.map((feat: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-4 rounded-xl transition-colors"
                    style={{ background: c.cardAlt, border: `1px solid ${c.border}` }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: c.success }}>
                      <CheckCircle2 className="w-4 h-4" style={{ color: c.successText }} />
                    </div>
                    <span className="text-sm leading-relaxed" style={{ color: c.textSoft }}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── SECTION 8 — PRICING ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.public.investment')} c={c} />
          <div
            className="backdrop-blur-xl rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto"
            style={{ background: c.pricingGradient, border: `1px solid ${c.borderAccent}` }}
          >
            <p className="text-sm mb-3 uppercase tracking-wider font-medium" style={{ color: c.textMuted }}>
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.monthlyInvestment')
                : t('proposal.public.yearlyInvestment')}
            </p>
            <div className="flex items-baseline justify-center gap-1 mb-3">
              <span className="text-6xl md:text-7xl font-bold tabular-nums tracking-tight" style={{ color: c.text }}>
                {formatCurrency(proposal.custom_price, proposal.currency)}
              </span>
            </div>
            <p className="text-sm" style={{ color: c.textMuted }}>
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.billedMonthly')
                : t('proposal.public.billedYearly')}
            </p>

            {proposal.base_plan && proposal.base_plan.price > proposal.custom_price && (
              <div
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: c.success, border: `1px solid ${c.successBorder}` }}
              >
                <span className="text-sm font-semibold" style={{ color: c.successText }}>
                  {t('proposal.public.savings')} {formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency)}
                </span>
                <span className="text-xs" style={{ color: c.successText, opacity: 0.5 }}>vs. {proposal.base_plan.name}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 9 — NEXT STEPS / CTA ── */}
        <section className="py-20">
          <SectionHeader label={t('proposal.full.nextStepsLabel')} c={c} />
          <div className="backdrop-blur-xl rounded-2xl p-8 md:p-12 max-w-3xl mx-auto" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            {isExpired ? (
              <div className="flex items-center gap-4 p-5 rounded-xl" style={{ background: c.error, border: `1px solid ${c.errorBorder}` }}>
                <AlertTriangle className="w-6 h-6 shrink-0" style={{ color: c.errorText }} />
                <div>
                  <p className="font-semibold" style={{ color: c.errorText }}>{t('proposal.public.expired')}</p>
                  <p className="text-sm mt-1" style={{ color: c.errorText, opacity: 0.6 }}>{t('proposal.public.expiredDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <div className="flex items-center gap-2 text-sm mb-6" style={{ color: c.textMuted }}>
                    <Clock className="w-4 h-4" />
                    {t('proposal.public.validUntilLabel')} <strong style={{ color: c.textSoft }}>{formatDate(proposal.valid_until, lang)}</strong>
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-4" style={{ color: c.text }}>{t('proposal.full.nextStepsTitle')}</h3>
                <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
                  {t('proposal.public.ctaText')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(proposal.custom_plan_name)}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                    style={{ background: c.btnGradient }}
                  >
                    <Mail className="w-4 h-4" />
                    {t('proposal.public.getStarted')}
                  </a>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(t('proposal.public.questionSubject'))}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-medium text-sm transition-all"
                    style={{ border: `1px solid ${c.border}`, color: c.textSoft }}
                  >
                    {t('proposal.public.haveQuestions')}
                  </a>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="text-center space-y-3 py-12" style={{ borderTop: `1px solid ${c.border}` }}>
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: c.textMuted }}>{APP_NAME}</span>
          </div>
          <p className="text-xs max-w-md mx-auto" style={{ color: c.textFaint }}>
            {t('proposal.public.footerNote')}
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Reusable section header */
function SectionHeader({ label, c }: { label: string; c: ReturnType<typeof import('./proposalShared').themeColors> }) {
  return (
    <h2 className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[.2em] mb-8" style={{ color: c.textMuted }}>
      <span className="w-12 h-[1px]" style={{ background: `linear-gradient(to right, transparent, ${c.border})` }} />
      {label}
      <span className="w-12 h-[1px]" style={{ background: `linear-gradient(to left, transparent, ${c.border})` }} />
    </h2>
  );
}
