import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, AlertTriangle, Globe } from 'lucide-react';
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
  company_name: string | null;
  company_domain: string | null;
}

const SUPPORTED_LANGS = ['en', 'es', 'pt-br'];

function detectLang(): string {
  // Check query param first  
  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get('lang')?.toLowerCase();
  if (queryLang && SUPPORTED_LANGS.includes(queryLang)) return queryLang;

  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  // Check prefix match (e.g. pt → pt-br)
  const prefix = browserLang.split('-')[0] ?? '';
  if (prefix === 'pt') return 'pt-br';
  if (prefix && SUPPORTED_LANGS.includes(prefix)) return prefix;

  return 'en';
}

function getCurrencySymbol(currency: string) {
  const map: Record<string, string> = { usd: '$', brl: 'R$', eur: '€' };
  return map[currency] || '$';
}

function formatValidUntil(date: string, lang: string) {
  try {
    const locale = lang === 'pt-br' ? 'pt-BR' : lang;
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

  // Switch i18n to detected language
  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    if (!slug) return;
    async function fetchProposal() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/proposals/public/${slug}`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        if (json.success && json.data) {
          setProposal(json.data);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchProposal();
  }, [slug]);

  // Update page title
  useEffect(() => {
    document.title = proposal
      ? `${proposal.custom_plan_name} — ${APP_NAME}`
      : `${t('proposal.public.title')} — ${APP_NAME}`;
  }, [proposal, t]);

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
  const symbol = getCurrencySymbol(proposal.currency);
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.perMonth')
    : t('proposal.perYear');

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[100px] pointer-events-none" />

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-1 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-1">
          <Globe className="w-3.5 h-3.5 text-white/40 ml-2" />
          {SUPPORTED_LANGS.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-xs font-medium uppercase transition-colors ${
                lang === l
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {l === 'pt-br' ? 'PT' : l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Tag */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {t('proposal.public.customPlan')}
          </span>
        </div>

        {/* Main card */}
        <div className="bg-white/[.03] backdrop-blur-xl border border-white/[.08] rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-white/[.06]">
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
              {proposal.custom_plan_name}
            </h1>
            <p className="text-white/50 text-sm">{t('proposal.public.preparedFor')}</p>

            {/* Price */}
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-lg text-white/40">{symbol}</span>
              <span className="text-5xl font-bold text-white tabular-nums">{proposal.custom_price}</span>
              <span className="text-white/40 text-lg ml-1">{intervalLabel}</span>
            </div>
          </div>

          {/* Description */}
          {description && (
            <div className="px-8 py-5 border-b border-white/[.06]">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">
                {t('proposal.public.planDetails')}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{description}</p>
            </div>
          )}

          {/* Features */}
          {features.length > 0 && (
            <div className="px-8 py-6 border-b border-white/[.06]">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                {t('proposal.public.whatsIncluded')}
              </h3>
              <ul className="space-y-3">
                {features.map((feat: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-white/80 text-sm">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer: validity / expiration */}
          <div className="px-8 py-5">
            {isExpired ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-red-300 text-sm font-medium">{t('proposal.public.expired')}</p>
                  <p className="text-red-300/60 text-xs mt-0.5">{t('proposal.public.expiredDesc')}</p>
                </div>
              </div>
            ) : (
              <>
                {proposal.valid_until && (
                  <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
                    <Clock className="w-4 h-4" />
                    {t('proposal.public.validUntilLabel')} {formatValidUntil(proposal.valid_until, lang)}
                  </div>
                )}
                <a
                  href={`mailto:contact@${proposal.company_domain || 'ainalytics.com'}?subject=${encodeURIComponent(proposal.custom_plan_name)}`}
                  className="block w-full text-center py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                >
                  {t('proposal.public.getStarted')}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Powered by */}
        <p className="text-center text-white/20 text-xs mt-8">
          {t('proposal.public.poweredBy')} {APP_NAME}
        </p>
      </div>
    </div>
  );
}
