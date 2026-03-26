import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, AlertTriangle, Globe, Mail, Sparkles } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from '@/lib/constants';

interface ProposalData {
  slug: string;
  custom_plan_name: string;
  custom_price: number;
  billing_interval: string;
  currency: string;
  custom_features: Record<string, string[]>;
  custom_description: Record<string, string>;
  status: string;
  valid_until: string | null;
  viewed_at: string | null;
  created_at: string;
  base_plan: { name: string; price: number } | null;
  client_name: string | null;
  company_name: string | null;
  company_domain: string | null;
}

const SUPPORTED_LANGS = ['en', 'es', 'pt-br'];

function detectLang(): string {
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get('lang')?.toLowerCase();
  if (queryLang && SUPPORTED_LANGS.includes(queryLang)) return queryLang;
  const browserLang = navigator.language.toLowerCase();
  if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  const prefix = browserLang.split('-')[0] ?? '';
  if (prefix === 'pt') return 'pt-br';
  if (prefix && SUPPORTED_LANGS.includes(prefix)) return prefix;
  return 'en';
}

function formatCurrency(value: number, currency: string): string {
  const localeMap: Record<string, string> = { usd: 'en-US', brl: 'pt-BR', eur: 'de-DE' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: string, lang: string) {
  try {
    const locale = lang === 'pt-br' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
  } catch {
    return date;
  }
}

export function ProposalPublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lang, setLang] = useState(detectLang);

  useEffect(() => { i18n.changeLanguage(lang); }, [lang, i18n]);

  useEffect(() => {
    if (!slug) return;
    async function fetchProposal() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/proposals/public/${slug}`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        });
        if (!res.ok) { setNotFound(true); return; }
        const json = await res.json();
        if (json.success && json.data) setProposal(json.data);
        else setNotFound(true);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    }
    fetchProposal();
  }, [slug]);

  useEffect(() => {
    document.title = proposal
      ? `${proposal.custom_plan_name} — ${APP_NAME}`
      : `${t('proposal.public.title')} — ${APP_NAME}`;
  }, [proposal, t]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background ambient */}
      <div className="absolute top-[-200px] right-[-200px] w-[700px] h-[700px] bg-indigo-600/[.06] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-200px] left-[-200px] w-[600px] h-[600px] bg-violet-600/[.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/[.02] rounded-full blur-[200px] pointer-events-none" />

      {/* Language switcher */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center gap-1 bg-white/[.05] backdrop-blur-md rounded-lg border border-white/10 p-1">
          <Globe className="w-3.5 h-3.5 text-white/40 ml-2" />
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-xs font-medium uppercase transition-colors ${
                lang === l ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {l === 'pt-br' ? 'PT' : l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-24">

        {/* ═══════════════════════════════════════════════
            SECTION 1 — HEADER / BRANDING
            ═══════════════════════════════════════════════ */}
        <header className="text-center mb-16">
          {/* Company logo / name */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">{APP_NAME}</span>
          </div>

          {/* Document type badge */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-widest">
              {t('proposal.public.customPlan')}
            </span>
          </div>

          {/* Proposal title */}
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
            {proposal.custom_plan_name}
          </h1>

          {/* Date */}
          <p className="text-white/30 text-sm">
            {formatDate(proposal.created_at, lang)}
          </p>
        </header>

        {/* ═══════════════════════════════════════════════
            SECTION 2 — GREETING / CLIENT INFO
            ═══════════════════════════════════════════════ */}
        <section className="mb-16">
          <div className="bg-white/[.03] backdrop-blur-xl border border-white/[.08] rounded-2xl p-8 md:p-10">
            {proposal.client_name && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-indigo-400/70 uppercase tracking-widest mb-1">
                  {t('proposal.public.preparedFor')}
                </p>
                <p className="text-2xl font-bold text-white">{proposal.client_name}</p>
                {proposal.company_name && (
                  <p className="text-white/40 text-sm mt-0.5">{proposal.company_name}</p>
                )}
              </div>
            )}
            {!proposal.client_name && proposal.company_name && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-indigo-400/70 uppercase tracking-widest mb-1">
                  {t('proposal.public.preparedFor')}
                </p>
                <p className="text-2xl font-bold text-white">{proposal.company_name}</p>
              </div>
            )}
            <div className="border-t border-white/[.06] pt-6">
              <p className="text-white/60 text-base leading-relaxed">
                {t('proposal.public.introText')}
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            SECTION 3 — DESCRIPTION / ABOUT THE PRODUCT
            ═══════════════════════════════════════════════ */}
        {description && (
          <section className="mb-16">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-white/50 uppercase tracking-widest mb-6">
              <span className="w-8 h-[1px] bg-gradient-to-r from-indigo-500/50 to-transparent" />
              {t('proposal.public.planDetails')}
            </h2>
            <div className="bg-white/[.03] backdrop-blur-xl border border-white/[.08] rounded-2xl p-8 md:p-10">
              <p className="text-white/70 text-base leading-[1.8] whitespace-pre-line">{description}</p>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════
            SECTION 4 — FEATURES / WHAT'S INCLUDED
            ═══════════════════════════════════════════════ */}
        {features.length > 0 && (
          <section className="mb-16">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-white/50 uppercase tracking-widest mb-6">
              <span className="w-8 h-[1px] bg-gradient-to-r from-indigo-500/50 to-transparent" />
              {t('proposal.public.whatsIncluded')}
            </h2>
            <div className="bg-white/[.03] backdrop-blur-xl border border-white/[.08] rounded-2xl p-8 md:p-10">
              <div className="grid gap-4 md:grid-cols-2">
                {features.map((feat: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-4 rounded-xl bg-white/[.02] border border-white/[.05] transition-colors hover:border-indigo-500/20 hover:bg-indigo-500/[.03]"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-white/80 text-sm leading-relaxed">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════
            SECTION 5 — PRICING
            ═══════════════════════════════════════════════ */}
        <section className="mb-16">
          <h2 className="flex items-center gap-3 text-sm font-semibold text-white/50 uppercase tracking-widest mb-6">
            <span className="w-8 h-[1px] bg-gradient-to-r from-indigo-500/50 to-transparent" />
            {t('proposal.public.investment')}
          </h2>
          <div className="bg-gradient-to-br from-indigo-600/10 via-white/[.03] to-violet-600/10 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-8 md:p-10 text-center">
            <p className="text-white/40 text-sm mb-2 uppercase tracking-wider font-medium">
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.monthlyInvestment')
                : t('proposal.public.yearlyInvestment')}
            </p>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-6xl md:text-7xl font-bold text-white tabular-nums tracking-tight">
                {formatCurrency(proposal.custom_price, proposal.currency)}
              </span>
            </div>
            <p className="text-white/30 text-sm">
              {proposal.billing_interval === 'monthly'
                ? t('proposal.public.billedMonthly')
                : t('proposal.public.billedYearly')}
            </p>

            {proposal.base_plan && proposal.base_plan.price > proposal.custom_price && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 text-sm font-semibold">
                  {t('proposal.public.savings')} {formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency)}
                </span>
                <span className="text-emerald-400/50 text-xs">
                  vs. {proposal.base_plan.name}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            SECTION 6 — VALIDITY & CTA
            ═══════════════════════════════════════════════ */}
        <section className="mb-12">
          <div className="bg-white/[.03] backdrop-blur-xl border border-white/[.08] rounded-2xl p-8 md:p-10">
            {isExpired ? (
              <div className="flex items-center gap-4 p-5 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <p className="text-red-300 font-semibold">{t('proposal.public.expired')}</p>
                  <p className="text-red-300/60 text-sm mt-1">{t('proposal.public.expiredDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
                    <Clock className="w-4 h-4" />
                    {t('proposal.public.validUntilLabel')} <strong className="text-white/60">{formatDate(proposal.valid_until, lang)}</strong>
                  </div>
                )}

                <p className="text-white/50 text-sm mb-6 leading-relaxed">
                  {t('proposal.public.ctaText')}
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(proposal.custom_plan_name)}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                  >
                    <Mail className="w-4 h-4" />
                    {t('proposal.public.getStarted')}
                  </a>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(t('proposal.public.questionSubject'))}`}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 font-medium text-sm transition-all"
                  >
                    {t('proposal.public.haveQuestions')}
                  </a>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════════ */}
        <footer className="text-center space-y-2 py-8 border-t border-white/[.05]">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-white/30">{APP_NAME}</span>
          </div>
          <p className="text-white/15 text-xs">
            {t('proposal.public.footerNote')}
          </p>
        </footer>
      </div>
    </div>
  );
}
