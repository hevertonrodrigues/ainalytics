import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Globe, ArrowLeft, FileQuestion, Mail, Loader2 } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useProposalData, formatCurrency, formatDate, acceptProposal, SUPPORTED_LANGS } from './proposalShared';

export function ProposalFullPage() {
  const { proposal, loading, notFound, lang, setLang, slug, c } = useProposalData();
  const { t } = useTranslation();

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptEmail, setAcceptEmail] = useState('');
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [accepted, setAccepted] = useState(false);

  // Auto-trigger print when ?print=1
  useEffect(() => {
    if (!proposal || loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('print') === '1') {
      const timer = setTimeout(() => window.print(), 1500);
      return () => clearTimeout(timer);
    }
  }, [proposal, loading]);

  async function handleAccept() {
    if (!acceptEmail.trim() || !slug) return;
    setAcceptLoading(true);
    setAcceptError('');
    const result = await acceptProposal(slug, acceptEmail.trim());
    setAcceptLoading(false);
    if (result.checkout_url) {
      // Redirect to Stripe Checkout
      window.location.href = result.checkout_url;
      return;
    }
    if (result.accepted) {
      setAccepted(true);
      setShowAcceptModal(false);
    } else {
      setAcceptError(result.error === 'EMAIL_MISMATCH' ? t('proposal.public.acceptEmailMismatch') : t('proposal.public.acceptError'));
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ background: c.bg }} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse space-y-3 text-center">
          <div className="w-32 h-3 rounded mx-auto" style={{ background: c.border }} />
          <div className="w-48 h-3 rounded mx-auto" style={{ background: c.border }} />
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound || !proposal) {
    return (
      <div className="error-boundary-page">
        <div className="error-boundary-card">
          <div className="error-boundary-icon-wrapper">
            <div className="error-boundary-icon-glow" />
            <div className="error-boundary-icon-ring">
              <FileQuestion className="error-boundary-icon" />
            </div>
          </div>
          <div className="error-boundary-content">
            <h1 className="error-boundary-title">{t('errorPages.proposalNotFoundTitle', 'This Proposal Is Unavailable')}</h1>
            <p className="error-boundary-subtitle">{t('errorPages.proposalNotFoundSubtitle', "The proposal you're looking for may have expired or doesn't exist.")}</p>
          </div>
          <div className="error-boundary-actions">
            <a href="mailto:contato@ainalytics.tech" className="error-boundary-btn-primary">
              <Mail className="w-4 h-4" />
              {t('errorPages.contactUs', 'Contact Us')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = proposal.status === 'expired';
  const checkoutResult = new URLSearchParams(window.location.search).get('checkout');
  const isAccepted = accepted || proposal.status === 'accepted' || proposal.status === 'pending_payment' || checkoutResult === 'success';
  const defaultLang = proposal.default_lang || 'en';
  const features = proposal.custom_features[defaultLang] || proposal.custom_features['en'] || [];
  const description = proposal.custom_description[defaultLang] || proposal.custom_description['en'] || '';
  const contactEmail = 'contato@ainalytics.tech';

  const advantages: string[] = (t('proposal.full.advantages', { returnObjects: true }) as string[]) || [];
  const advantageDescs: string[] = (t('proposal.full.advantageDescs', { returnObjects: true }) as string[]) || [];
  const solutionItems: string[] = (t('proposal.full.solutionItems', { returnObjects: true }) as string[]) || [];

  return (
    <div style={{ background: c.bg }} className="min-h-screen relative" id="proposal-full-content">

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

      {/* Back link */}
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

        {/* ── COVER ── */}
        <section className="min-h-[80vh] flex flex-col items-center justify-center text-center py-20">
          <p className="text-xs uppercase tracking-[.2em] mb-6" style={{ color: c.textMuted }}>
            {t('proposal.public.preparedFor')}
          </p>

          {proposal.client_name && (
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-3" style={{ color: c.text }}>
              {proposal.client_name}
            </h1>
          )}
          {proposal.company_name && (
            <p className="text-xl md:text-2xl mb-6" style={{ color: c.textSoft }}>
              {proposal.company_name}
            </p>
          )}
          {!proposal.client_name && !proposal.company_name && (
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6" style={{ color: c.text }}>
              {proposal.custom_plan_name}
            </h1>
          )}

          <div className="w-12 h-px mx-auto my-8" style={{ background: c.border }} />

          <p className="text-sm uppercase tracking-[.15em] font-medium" style={{ color: c.textMuted }}>
            {proposal.custom_plan_name}
          </p>
          <p className="text-xs mt-3" style={{ color: c.textFaint }}>{formatDate(proposal.created_at, lang)}</p>

          <div className="mt-16 animate-bounce print:hidden">
            <div className="w-6 h-10 rounded-full flex items-start justify-center p-2" style={{ border: `2px solid ${c.border}` }}>
              <div className="w-1.5 h-2.5 rounded-full" style={{ background: c.textFaint }} />
            </div>
          </div>
        </section>

        {/* Divider */}
        <Divider c={c} />

        {/* ── ABOUT US ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.full.aboutUsLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6" style={{ color: c.text }}>{t('proposal.full.aboutUsTitle')}</h2>
            <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>
              {t('proposal.full.aboutUsText')}
            </p>
          </div>
        </section>

        <Divider c={c} />

        {/* ── THE PROBLEM ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.full.problemLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6" style={{ color: c.text }}>{t('proposal.full.problemTitle')}</h2>
            <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>
              {t('proposal.full.problemText')}
            </p>
          </div>
        </section>

        <Divider c={c} />

        {/* ── OUR SOLUTION ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.full.solutionLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8" style={{ color: c.text }}>{t('proposal.full.solutionTitle')}</h2>
            <div className="space-y-4">
              {solutionItems.map((item: string, idx: number) => (
                <div key={idx} className="flex items-start gap-4">
                  <span className="text-sm font-semibold shrink-0 w-6 text-right tabular-nums" style={{ color: c.textMuted }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: c.textSoft }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Divider c={c} />

        {/* ── COMPETITIVE ADVANTAGES ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.full.advantagesLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8" style={{ color: c.text }}>{t('proposal.full.advantagesTitle')}</h2>
            <div className="space-y-6">
              {advantages.map((adv: string, idx: number) => (
                <div key={idx}>
                  <p className="font-medium text-sm mb-1" style={{ color: c.text }}>{adv}</p>
                  {advantageDescs[idx] && (
                    <p className="text-sm leading-relaxed" style={{ color: c.textMuted }}>{advantageDescs[idx]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PLAN DETAILS ── */}
        {description && (
          <>
            <Divider c={c} />
            <section className="py-20">
              <SectionLabel text={t('proposal.public.planDetails')} c={c} />
              <div className="max-w-3xl mx-auto">
                <p className="text-base leading-[1.9] whitespace-pre-line" style={{ color: c.textSoft }}>{description}</p>
              </div>
            </section>
          </>
        )}

        {/* ── FEATURES ── */}
        {features.length > 0 && (
          <>
            <Divider c={c} />
            <section className="py-20">
              <SectionLabel text={t('proposal.public.whatsIncluded')} c={c} />
              <div className="max-w-3xl mx-auto">
                <div className="grid gap-3 md:grid-cols-2">
                  {features.map((feat: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 py-2">
                      <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: c.badgeText }} />
                      <span className="text-sm leading-relaxed" style={{ color: c.textSoft }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        <Divider c={c} />

        {/* ── PRICING ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.public.investment')} c={c} />
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs uppercase tracking-[.15em] font-medium mb-4" style={{ color: c.textMuted }}>
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.monthlyInvestment')
                : t('proposal.public.yearlyInvestment')}
            </p>
            <span className="text-6xl md:text-7xl font-bold tabular-nums tracking-tight" style={{ color: c.text }}>
              {formatCurrency(proposal.custom_price, proposal.currency)}
            </span>
            <p className="text-sm mt-3" style={{ color: c.textMuted }}>
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.billedMonthly')
                : t('proposal.public.billedYearly')}
            </p>

            {proposal.base_plan && proposal.base_plan.price > proposal.custom_price && (
              <p className="text-sm mt-4" style={{ color: c.successText }}>
                {t('proposal.public.savings')} {formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency)}
                <span className="ml-2 text-xs" style={{ opacity: 0.5 }}>vs. {proposal.base_plan.name}</span>
              </p>
            )}
          </div>
        </section>

        <Divider c={c} />

        {/* ── NEXT STEPS ── */}
        <section className="py-20">
          <SectionLabel text={t('proposal.full.nextStepsLabel')} c={c} />
          <div className="max-w-3xl mx-auto">
            {isExpired ? (
              <div className="text-center py-4">
                <p className="text-sm font-medium" style={{ color: c.errorText }}>{t('proposal.public.expired')}</p>
                <p className="text-xs mt-1" style={{ color: c.textMuted }}>{t('proposal.public.expiredDesc')}</p>
              </div>
            ) : isAccepted ? (
              <div className="text-center py-4">
                <p className="text-sm font-medium" style={{ color: c.successText }}>{t('proposal.public.acceptedStatus')}</p>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <p className="text-xs mb-6" style={{ color: c.textMuted }}>
                    {t('proposal.public.validUntilLabel')} {formatDate(proposal.valid_until, lang)}
                  </p>
                )}
                <h3 className="text-2xl font-bold mb-4" style={{ color: c.text }}>{t('proposal.full.nextStepsTitle')}</h3>
                <p className="text-sm mb-8 leading-relaxed" style={{ color: c.textMuted }}>
                  {t('proposal.public.ctaText')}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowAcceptModal(true)}
                    className="flex-1 py-4 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
                    style={{ background: c.btnGradient }}
                  >
                    {t('proposal.public.acceptProposal')}
                  </button>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(t('proposal.public.questionSubject'))}`}
                    className="flex-1 flex items-center justify-center py-4 rounded-xl font-medium text-sm transition-all"
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
        <footer className="text-center py-12" style={{ borderTop: `1px solid ${c.border}` }}>
          <p className="text-xs" style={{ color: c.textFaint }}>
            {t('proposal.public.footerNote')}
          </p>
          <p className="text-xs mt-2 font-medium" style={{ color: c.textMuted }}>{APP_NAME}</p>
        </footer>
      </div>

      {/* ── Accept Modal ── */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAcceptModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: c.shadow }}
          >
            <div>
              <h3 className="text-lg font-semibold" style={{ color: c.text }}>{t('proposal.public.acceptModalTitle')}</h3>
              <p className="text-sm mt-1" style={{ color: c.textMuted }}>{t('proposal.public.acceptModalDesc')}</p>
            </div>
            <input
              type="email"
              value={acceptEmail}
              onChange={e => setAcceptEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAccept(); }}
              placeholder={t('proposal.public.acceptEmailPlaceholder')}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{
                background: c.card,
                border: `1px solid ${acceptError ? c.errorBorder : c.border}`,
                color: c.text,
              }}
              autoFocus
            />
            {acceptError && (
              <p className="text-xs" style={{ color: c.errorText }}>{acceptError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowAcceptModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                style={{ border: `1px solid ${c.border}`, color: c.textSoft }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAccept}
                disabled={acceptLoading || !acceptEmail.trim()}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer"
                style={{ background: c.btnGradient }}
              >
                {acceptLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('proposal.public.acceptConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Minimal section label */
function SectionLabel({ text, c }: { text: string; c: ReturnType<typeof import('./proposalShared').themeColors> }) {
  return (
    <p className="text-xs uppercase tracking-[.2em] font-medium mb-8" style={{ color: c.textMuted }}>
      {text}
    </p>
  );
}

/** Thin divider */
function Divider({ c }: { c: ReturnType<typeof import('./proposalShared').themeColors> }) {
  return <div className="w-12 h-px mx-auto" style={{ background: c.border }} />;
}
