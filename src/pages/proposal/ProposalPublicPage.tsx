import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, AlertTriangle, Globe, Mail, Sparkles, ArrowRight } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { useProposalData, formatCurrency, formatDate, SUPPORTED_LANGS } from './proposalShared';

export function ProposalPublicPage() {
  const { proposal, loading, notFound, lang, setLang, slug, c } = useProposalData();
  const { t } = useTranslation();

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
  const contactEmail = `contact@${proposal.company_domain || 'ainalytics.com'}`;
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.billedMonthly')
    : t('proposal.public.billedYearly');

  return (
    <div style={{ background: c.bg }} className="min-h-screen relative overflow-hidden">
      {/* Background glows */}
      <div style={{ background: c.glow1 }} className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none" />
      <div style={{ background: c.glow2 }} className="absolute bottom-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" />

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
        {/* Branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: c.text }}>{APP_NAME}</span>
          </div>
          {(proposal.client_name || proposal.company_name) && (
            <p className="text-xs uppercase tracking-widest" style={{ color: c.textMuted }}>
              {t('proposal.public.preparedFor')} {proposal.client_name || proposal.company_name}
            </p>
          )}
        </div>

        {/* Main card */}
        <div
          className="backdrop-blur-xl rounded-2xl overflow-hidden"
          style={{ background: c.card, border: `1px solid ${c.border}`, boxShadow: c.shadow }}
        >
          {/* Plan name */}
          <div className="px-8 pt-8 pb-4 text-center" style={{ borderBottom: `1px solid ${c.border}` }}>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-4"
              style={{ background: c.badge, color: c.badgeText, border: `1px solid ${c.borderAccent}` }}
            >
              {t('proposal.public.customPlan')}
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: c.text }}>
              {proposal.custom_plan_name}
            </h1>
          </div>

          {/* Price — hero */}
          <div className="px-8 py-8 text-center" style={{ borderBottom: `1px solid ${c.border}`, background: c.pricingGradient }}>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl md:text-6xl font-bold tabular-nums tracking-tight" style={{ color: c.text }}>
                {formatCurrency(proposal.custom_price, proposal.currency)}
              </span>
            </div>
            <p className="text-sm" style={{ color: c.textMuted }}>{intervalLabel}</p>

            {proposal.base_plan && proposal.base_plan.price > proposal.custom_price && (
              <div
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: c.success, border: `1px solid ${c.successBorder}` }}
              >
                <span className="text-xs font-semibold" style={{ color: c.successText }}>
                  {t('proposal.public.savings')} {formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Feature list */}
          {features.length > 0 && (
            <div className="px-8 py-6" style={{ borderBottom: `1px solid ${c.border}` }}>
              <ul className="space-y-2.5">
                {features.map((feat: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: c.successText }} />
                    <span className="text-sm" style={{ color: c.textSoft }}>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <div className="px-8 py-6">
            {isExpired ? (
              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: c.error, border: `1px solid ${c.errorBorder}` }}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: c.errorText }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: c.errorText }}>{t('proposal.public.expired')}</p>
                  <p className="text-xs mt-0.5" style={{ color: c.errorText, opacity: 0.6 }}>{t('proposal.public.expiredDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <div className="flex items-center gap-2 text-xs mb-4" style={{ color: c.textMuted }}>
                    <Clock className="w-3.5 h-3.5" />
                    {t('proposal.public.validUntilLabel')} <strong style={{ color: c.textSoft }}>{formatDate(proposal.valid_until, lang)}</strong>
                  </div>
                )}
                <a
                  href={`mailto:${contactEmail}?subject=${encodeURIComponent(proposal.custom_plan_name)}`}
                  className="block w-full text-center py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                  style={{ background: c.btnGradient }}
                  onMouseOver={e => (e.currentTarget.style.background = c.btnGradientHover)}
                  onMouseOut={e => (e.currentTarget.style.background = c.btnGradient)}
                >
                  <Mail className="w-4 h-4 inline mr-2" />
                  {t('proposal.public.getStarted')}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Link to full presentation */}
        {!isExpired && (
          <Link
            to={`/proposal/${slug}/full`}
            className="mt-6 flex items-center justify-center gap-2 text-sm transition-colors group"
            style={{ color: c.badgeText, opacity: 0.7 }}
          >
            {t('proposal.public.viewFullPresentation')}
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}

        {/* Footer */}
        <p className="text-center text-xs mt-8" style={{ color: c.textFaint }}>
          {t('proposal.public.poweredBy')} {APP_NAME}
        </p>
      </div>
    </div>
  );
}
