import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from '@/lib/constants';

export type ProposalTheme = 'dark' | 'light';

export interface ProposalData {
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
  theme: ProposalTheme;
}

export const SUPPORTED_LANGS = ['en', 'es', 'pt-br'];

export function detectLang(): string {
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

export function formatCurrency(value: number, currency: string): string {
  const localeMap: Record<string, string> = { usd: 'en-US', brl: 'pt-BR', eur: 'de-DE' };
  return new Intl.NumberFormat(localeMap[currency] || 'en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string, lang: string): string {
  try {
    const locale = lang === 'pt-br' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
  } catch {
    return date;
  }
}

/** Theme-aware color tokens as CSS-in-JS */
export function themeColors(theme: ProposalTheme) {
  const isDark = theme === 'dark';
  return {
    bg:       isDark ? '#0a0a0f' : '#f8f9fc',
    card:     isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.9)',
    cardAlt:  isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    border:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    borderAccent: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)',
    text:     isDark ? '#ffffff' : '#1a1a2e',
    textSoft: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(26,26,46,0.70)',
    textMuted:isDark ? 'rgba(255,255,255,0.30)' : 'rgba(26,26,46,0.40)',
    textFaint:isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.15)',
    glow1:    isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)',
    glow2:    isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.03)',
    badge:    isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.08)',
    badgeText:isDark ? '#a5b4fc' : '#4f46e5',
    success:  isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.08)',
    successBorder: isDark ? 'rgba(16,185,129,0.20)' : 'rgba(16,185,129,0.15)',
    successText: isDark ? '#34d399' : '#059669',
    error:    isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.08)',
    errorBorder: isDark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.15)',
    errorText: isDark ? '#fca5a5' : '#dc2626',
    shadow:   isDark ? '0 25px 50px -12px rgba(0,0,0,0.4)' : '0 25px 50px -12px rgba(0,0,0,0.08)',
    btnGradient: 'linear-gradient(to right, #4f46e5, #7c3aed)',
    btnGradientHover: 'linear-gradient(to right, #6366f1, #8b5cf6)',
    pricingGradient: isDark
      ? 'linear-gradient(to bottom right, rgba(79,70,229,0.1), rgba(255,255,255,0.03), rgba(124,58,237,0.1))'
      : 'linear-gradient(to bottom right, rgba(79,70,229,0.06), rgba(255,255,255,0.5), rgba(124,58,237,0.06))',
  };
}

/** Shared hook: fetches proposal data by slug, manages loading/error/language/theme state */
export function useProposalData() {
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

  const theme: ProposalTheme = proposal?.theme || 'dark';
  const c = themeColors(theme);

  return { proposal, loading, notFound, lang, setLang, slug, theme, c };
}
