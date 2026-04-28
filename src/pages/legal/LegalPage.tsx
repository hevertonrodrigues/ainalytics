import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LandingHeader } from '@/pages/landing/LandingHeader';
import { LandingFooter } from '@/pages/landing/LandingFooter';
import { useSeo, SITE_URL } from '@/lib/seo';

const LEGAL_CONFIG: Record<string, { titleKey: string; dbKey: string }> = {
  '/terms': { titleKey: 'legal.termsTitle', dbKey: 'TERMS' },
  '/privacy': { titleKey: 'legal.privacyTitle', dbKey: 'PRIVACY' },
};

export function LegalPage() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const config = LEGAL_CONFIG[pathname] ?? LEGAL_CONFIG['/terms']!;
  const isPrivacy = pathname === '/privacy';

  useSeo({
    title: `${isPrivacy ? 'Política de Privacidade' : 'Termos de Uso'} · Ainalytics`,
    description: isPrivacy
      ? 'Política de Privacidade da Ainalytics — como coletamos, usamos e protegemos seus dados.'
      : 'Termos de Uso da Ainalytics — condições para utilização da plataforma de monitoramento de visibilidade em IA.',
    canonical: `${SITE_URL}${pathname}`,
    robots: 'index,follow',
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadContent() {
      try {
        const { data, error } = await supabase
          .from('general_settings')
          .select('value')
          .ilike('key', config.dbKey)
          .single();

        if (error) throw error;
        if (cancelled) return;

        const parsed = JSON.parse(data.value);
        const lang = i18n.language || 'en';
        setContent(parsed[lang] || parsed['en'] || '');
      } catch (err) {
        console.error('Failed to load legal content:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadContent();
    return () => { cancelled = true; };
  }, [config.dbKey, i18n.language]);

  return (
    <div className="landing-page">
      <LandingHeader scrolled />
      <main className="legal-page">
        <div className="legal-container">
          <h1>{t(config.titleKey)}</h1>
          {loading ? (
            <div className="legal-skeleton">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: '1rem', marginBottom: '0.75rem', width: i % 2 === 0 ? '80%' : '100%' }} />
              ))}
            </div>
          ) : (
            <div
              className="legal-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
