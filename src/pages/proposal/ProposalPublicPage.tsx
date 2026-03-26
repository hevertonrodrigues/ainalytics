import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Globe, ArrowRight, FileQuestion, Mail, Loader2 } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useProposalData, formatCurrency, formatDate, acceptProposal, SUPPORTED_LANGS } from './proposalShared';

export function ProposalPublicPage() {
  const { proposal, loading, notFound, lang, setLang, slug, c } = useProposalData();
  const { t } = useTranslation();

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptEmail, setAcceptEmail] = useState('');
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const [accepted, setAccepted] = useState(false);

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
  const isPendingPayment = proposal.status === 'pending_payment' && checkoutResult !== 'success';
  const isFullyAccepted = accepted || proposal.status === 'accepted' || checkoutResult === 'success';
  const defaultLang = proposal.default_lang || 'en';
  const features = proposal.custom_features[defaultLang] || proposal.custom_features['en'] || [];
  const contactEmail = 'contato@ainalytics.tech';
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.billedMonthly')
    : t('proposal.public.billedYearly');

  return (
    <div style={{ background: c.bg }} className="min-h-screen relative">
      {/* Language switcher */}
      <div className="fixed top-4 right-4 z-50">
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

      <div className="relative max-w-lg mx-auto px-6 py-16 md:py-24">
        {/* Header — Client & Company */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[.2em] mb-6" style={{ color: c.textMuted }}>
            {t('proposal.public.preparedFor')}
          </p>
          {proposal.client_name && (
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight" style={{ color: c.text }}>
              {proposal.client_name}
            </h2>
          )}
          {proposal.company_name && (
            <p className="text-lg mt-1" style={{ color: c.textSoft }}>
              {proposal.company_name}
            </p>
          )}
          {!proposal.client_name && !proposal.company_name && (
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: c.text }}>
              {t('proposal.public.customPlan')}
            </h2>
          )}
        </div>

        {/* Plan card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${c.border}` }}
        >
          {/* Plan name + price */}
          <div className="px-8 py-8" style={{ borderBottom: `1px solid ${c.border}` }}>
            <p className="text-xs uppercase tracking-[.15em] font-medium mb-3" style={{ color: c.textMuted }}>
              {proposal.custom_plan_name}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums tracking-tight" style={{ color: c.text }}>
                {formatCurrency(proposal.custom_price, proposal.currency)}
              </span>
            </div>
            <p className="text-sm mt-2" style={{ color: c.textMuted }}>{intervalLabel}</p>

            {proposal.base_plan && proposal.base_plan.price > proposal.custom_price && (
              <p className="text-xs mt-3" style={{ color: c.successText }}>
                {t('proposal.public.savings')} {formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency)}
              </p>
            )}
          </div>

          {/* Features */}
          {features.length > 0 && (
            <div className="px-8 py-6" style={{ borderBottom: `1px solid ${c.border}` }}>
              <ul className="space-y-3">
                {features.map((feat: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: c.badgeText }} />
                    <span className="text-sm leading-relaxed" style={{ color: c.textSoft }}>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="px-8 py-6">
            {isExpired ? (
              <div className="text-center py-2">
                <p className="text-sm font-medium" style={{ color: c.errorText }}>{t('proposal.public.expired')}</p>
                <p className="text-xs mt-1" style={{ color: c.textMuted }}>{t('proposal.public.expiredDesc')}</p>
              </div>
            ) : isFullyAccepted ? (
              <div className="text-center py-2">
                <p className="text-sm font-medium" style={{ color: c.successText }}>{t('proposal.public.acceptedStatus')}</p>
              </div>
            ) : isPendingPayment ? (
              <div className="text-center py-2 space-y-3">
                <p className="text-sm font-medium" style={{ color: c.successText }}>{t('proposal.public.acceptedStatus')}</p>
                <button
                  onClick={() => setShowAcceptModal(true)}
                  className="block w-full text-center py-3.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
                  style={{ background: c.btnGradient }}
                >
                  {t('proposal.public.completePayment')}
                </button>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <p className="text-xs mb-4" style={{ color: c.textMuted }}>
                    {t('proposal.public.validUntilLabel')} {formatDate(proposal.valid_until, lang)}
                  </p>
                )}
                <button
                  onClick={() => setShowAcceptModal(true)}
                  className="block w-full text-center py-3.5 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.98] cursor-pointer"
                  style={{ background: c.btnGradient }}
                >
                  {t('proposal.public.acceptProposal')}
                </button>
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(proposal.custom_plan_name)}`}
                  className="block w-full text-center py-3 mt-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ color: c.textMuted }}
                >
                  {t('proposal.public.haveQuestions')}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Link to full presentation */}
        {!isExpired && !isFullyAccepted && (
          <Link
            to={`/proposal/${slug}/full`}
            className="mt-8 flex items-center justify-center gap-2 text-sm transition-colors group"
            style={{ color: c.textMuted }}
          >
            {t('proposal.public.viewFullPresentation')}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        {/* Footer */}
        <p className="text-center text-xs mt-10" style={{ color: c.textFaint }}>
          {APP_NAME}
        </p>
      </div>

      {/* ── Accept Modal ── */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
