import { useState, useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  Eye,
  CheckCircle,
  Star,
  ChevronDown,
  X,
  FileText,
  Download
} from 'lucide-react';
import { InterestLeadForm } from '@/components/InterestLeadForm';
import { APP_NAME } from '@/lib/constants';
import { trackCTAClick } from '@/lib/analytics';

/* ── Scroll Reveal ── */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.querySelectorAll('.sales-reveal').forEach((node) => node.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' },
    );

    el.querySelectorAll('.sales-reveal').forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ── FAQ Accordion Item ── */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sales-faq-item${open ? ' open' : ''}`}>
      <button className="sales-faq-q" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <ChevronDown className="w-5 h-5 sales-faq-chevron" />
      </button>
      <div className="sales-faq-a">
        <p>{answer}</p>
      </div>
    </div>
  );
}

/* ── Main Ebook Landing Page ── */

export function EbookPage() {
  const { t, i18n } = useTranslation();
  const revealRef = useScrollReveal();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [stickyCtaDismissed, setStickyCtaDismissed] = useState(false);

  // Show sticky CTA after scrolling past hero
  useEffect(() => {
    const onScroll = () => {
      if (!stickyCtaDismissed) {
        setShowStickyCta(window.scrollY > 500);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stickyCtaDismissed]);

  /* Default to pt-br unless ?lang= is explicitly in the URL */
  useEffect(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (!urlLang) {
      i18n.changeLanguage('pt-br');
    }
  }, [i18n]);

  /* Dynamic meta tags based on current language */
  useEffect(() => {
    const prevTitle = document.title;
    document.title = t('ebook.metaTitle', 'Guia Grátis | Ainalytics');

    // Update or create meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') ?? '';
    if (metaDesc) {
      metaDesc.setAttribute('content', t('ebook.metaDescription', 'Baixe grátis o guia completo de Visibilidade na IA.'));
    } else {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      metaDesc.setAttribute('content', t('ebook.metaDescription', 'Baixe grátis o guia completo de Visibilidade na IA.'));
      document.head.appendChild(metaDesc);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc) metaDesc.setAttribute('content', prevDesc);
    };
  }, [t]);

  const scrollToForm = () => {
    document.getElementById('ebook-signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isSuccess) {
    return (
      <div className="sales-page">
        <div className="sales-success-container">
          <CheckCircle className="w-20 h-20 text-success" />
          <h1>{t('ebook.successTitle', 'Guia a caminho!')}</h1>
          <p>{t('ebook.successDesc', 'Verifique seu e-mail para baixar o arquivo.')}</p>
          <RouterLink to="/" className="btn btn-primary btn-lg">
            {t('common.backToHome', 'Voltar para Início')}
          </RouterLink>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-page" ref={revealRef}>
      {/* ── Urgency Bar ── */}
      <div className="sales-urgency-bar">
        <TrendingUp className="w-4 h-4" />
        <span>{t('ebook.finalCtaUrgency', '📥 Já baixado por +2.500 profissionais de marketing esta semana')}</span>
      </div>

      {/* ══════════════ HERO ══════════════ */}
      <section className="sales-hero">
        <div className="sales-hero-bg" />
        <div className="sales-container sales-hero-content">
          <div className="sales-badge-row">
            <span className="sales-badge-trial">
              <FileText className="w-3.5 h-3.5" />
              {t('ebook.badgeFree', 'GUIA GRATUITO')}
            </span>
            <span className="sales-badge-discount">
              <Zap className="w-4 h-4" />
              {t('ebook.badgeInstant', 'Acesso Imediato')}
            </span>
            <span className="sales-badge-limited">
              <Clock className="w-3.5 h-3.5" />
              {t('ebook.badgePages', '42 páginas de estratégia')}
            </span>
          </div>
          <h1 className="sales-hero-title">
            {t('ebook.heroTitle1', 'Sua marca é invisível para a IA.')}
            <br />
            <span className="landing-gradient-text">{t('ebook.heroTitle2', 'Este guia mostra como mudar isso.')}</span>
          </h1>
          <p className="sales-hero-subtitle">{t('ebook.heroSubtitle', '230 milhões de pessoas perguntam ao ChatGPT toda semana...')}</p>
          
          <div className="sales-hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('ebook_hero_signup', '/guia-ia'); scrollToForm(); }}>
              {t('ebook.heroCta', 'Baixar o Guia Gratuito')}
              <Download className="w-5 h-5 ml-2" />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => { document.getElementById('ebook-chapters')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {t('ebook.heroCtaSecondary', 'Veja o que você vai aprender ↓')}
            </button>
          </div>
          <p className="sales-final-note mt-4 flex justify-center items-center gap-2">
            <Shield className="w-4 h-4" /> {t('ebook.trustIndicator', '✓ 100% grátis · Sem cartão de crédito · Acesso imediato')}
          </p>
        </div>
      </section>

      {/* ══════════════ PAIN POINTS ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('ebook.painTitle', 'O Maior Ponto Cego do Marketing')}</h2>
          <div className="sales-pain-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-pain-card glass-card">
                <Eye className="w-8 h-8 text-brand-accent" />
                <h3>{t(`ebook.pain${i}Title`, `Dor ${i}`)}</h3>
                <p>{t(`ebook.pain${i}Desc`, `Descrição da dor ${i}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ CHAPTERS / FASCINATION BULLETS ══════════════ */}
      <section id="ebook-chapters" className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('ebook.chaptersTitle', 'O Que Você Vai Descobrir')}</h2>
          <p className="sales-section-subtitle">{t('ebook.chaptersSubtitle', '42 páginas de estratégia prática')}</p>
          <div className="sales-bullets-grid">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="glass-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>
                  <CheckCircle className="w-5 h-5 text-success" />
                  {t(`ebook.chapter${i}Title`, `Capítulo ${i}`)}
                </h4>
                <p style={{ fontSize: '0.95rem' }}>
                  {t(`ebook.chapter${i}Desc`, `Descrição ${i}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ EBOOK PREVIEW ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('ebook.previewTitle', 'Uma Prévia do Que Te Espera')}</h2>
          <p className="sales-section-subtitle">{t('ebook.previewSubtitle', 'Baseado em dados reais de milhares de consultas')}</p>
          <div className="sales-pain-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
             {[1,2,3,4].map((i) => (
                <div key={i} className="sales-pain-card glass-card text-center">
                  <p className="font-semibold text-lg">{t(`ebook.previewStat${i}`, `Estatística ${i}`)}</p>
                </div>
             ))}
          </div>
        </div>
      </section>

      {/* ══════════════ SOCIAL PROOF ══════════════ */}
      <section className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <h2 className="sales-section-title">{t('ebook.proofTitle', 'O Que Estão Dizendo')}</h2>
          <div className="sales-proof-row">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sales-proof-card glass-card">
                <div className="sales-proof-stars">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star key={j} className="w-4 h-4" />
                  ))}
                </div>
                <p className="sales-proof-text">"{t(`ebook.testimonial${i}`, `Depoimento ${i}`)}"</p>
                <span className="sales-proof-author">{t(`ebook.testimonialAuthor${i}`, `Autor ${i}`)}</span>
              </div>
            ))}
          </div>
          <p className="text-center mt-12" style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>
            {t('ebook.proofStats', '📥 +2.500 downloads · ⭐ 4.8/5 avaliação média')}
          </p>
        </div>
      </section>

      {/* ══════════════ ABOUT BRAND ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container text-center max-w-3xl mx-auto">
          <h2 className="sales-section-title">{t('ebook.aboutTitle', 'Quem Está Por Trás')}</h2>
          <p className="sales-section-subtitle" style={{ lineHeight: 1.6 }}>
            {t('ebook.aboutBody', 'Este guia foi criado pela equipe Ainalytics.')}
          </p>
          <button className="btn btn-outline mt-6" onClick={() => scrollToForm()}>
            {t('ebook.aboutCta', 'Baixar o Guia Gratuito')}
          </button>
        </div>
      </section>

      {/* ══════════════ SIGNUP FORM ══════════════ */}
      <section id="ebook-signup" className="sales-section sales-section-alt sales-reveal">
        <div className="sales-container">
          <div className="sales-offer-card glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="sales-offer-header" style={{ paddingBottom: '1rem' }}>
              <div className="sales-badge-row" style={{ justifyContent: 'center' }}>
                <span className="sales-badge-trial">
                  <FileText className="w-3.5 h-3.5" />
                  {t('ebook.badgeFree', 'GUIA GRATUITO')}
                </span>
              </div>
              <h2>{t('ebook.formTitle', 'Cadastre-se e Receba')}</h2>
              <p className="sales-offer-subtitle">{t('ebook.formSubtitle', 'O link de download chega em segundos.')}</p>
            </div>

            <div className="sales-offer-body" style={{ padding: '2rem' }}>
              <InterestLeadForm variant="ebook" onSuccess={() => setIsSuccess(true)} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ OBJECTION FAQ ══════════════ */}
      <section className="sales-section sales-reveal">
        <div className="sales-container sales-faq-container">
          <h2 className="sales-section-title">{t('ebook.faqTitle', 'Perguntas Frequentes')}</h2>
          {[1, 2, 3, 4, 5].map((i) => (
            <FaqItem
              key={i}
              question={t(`ebook.faq${i}Q`, `Pergunta ${i}`)}
              answer={t(`ebook.faq${i}A`, `Resposta ${i}`)}
            />
          ))}
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section className="sales-final-cta sales-reveal">
        <div className="sales-container">
          <TrendingUp className="w-10 h-10 text-brand-secondary" />
          <h2>{t('ebook.finalCtaTitle', 'Enquanto Você Lê Isso, a IA Responde Sobre Seu Mercado')}</h2>
          <p>{t('ebook.finalCtaDesc', 'Cada pergunta é uma oportunidade de ser recomendado.')}</p>
          <button className="btn btn-primary btn-lg" onClick={() => { trackCTAClick('ebook_final_cta_signup', '/guia-ia'); scrollToForm(); }}>
            {t('ebook.finalCtaButton', 'Baixar o Guia Agora')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
          <span className="sales-final-note">{t('ebook.finalCtaTrust', '✓ Acesso imediato · ✓ Sem cartão de crédito')}</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sales-footer">
        <p>© {new Date().getFullYear()} {APP_NAME}. {t('landing.footer.rights', 'Todos os direitos reservados.')}</p>
        <div className="sales-footer-links">
          <RouterLink to="/terms" target="_blank" rel="noopener noreferrer">{t('landing.footer.terms', 'Termos')}</RouterLink>
          <RouterLink to="/privacy" target="_blank" rel="noopener noreferrer">{t('landing.footer.privacy', 'Privacidade')}</RouterLink>
          <RouterLink to="/contact" target="_blank" rel="noopener noreferrer">{t('landing.footer.contact', 'Contato')}</RouterLink>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className={`sales-sticky-cta ${showStickyCta && !stickyCtaDismissed ? 'visible' : ''}`}>
        <button className="btn btn-primary w-full" onClick={() => { trackCTAClick('ebook_sticky_signup', '/guia-ia'); scrollToForm(); }}>
          <FileText className="w-4 h-4 mr-2" />
          {t('ebook.stickyCta', 'Baixar Guia Grátis')}
        </button>
        <button
          className="sales-sticky-cta-dismiss"
          onClick={() => setStickyCtaDismissed(true)}
          aria-label="Dismiss"
          style={{ position: 'absolute', right: '1rem' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
