import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FaqItem {
  id: string;
  question_en: string;
  answer_en: string;
  question_pt: string | null;
  answer_pt: string | null;
  question_es: string | null;
  answer_es: string | null;
  sort_order: number;
}

const LANG_MAP: Record<string, { q: keyof FaqItem; a: keyof FaqItem }> = {
  en:      { q: 'question_en', a: 'answer_en' },
  'pt-br': { q: 'question_pt', a: 'answer_pt' },
  es:      { q: 'question_es', a: 'answer_es' },
};

export function LandingFAQ() {
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function loadFaqs() {
      const { data } = await supabase
        .from('faq')
        .select('*')
        .eq('status', 'public')
        .order('sort_order', { ascending: true });
      if (data) setFaqs(data);
    }
    loadFaqs();
  }, []);

  /* Set up IntersectionObserver AFTER faqs load and the section renders */
  useEffect(() => {
    if (faqs.length === 0) return;

    const el = sectionRef.current;
    if (!el) return;

    // Wait a frame so the DOM has painted
    const raf = requestAnimationFrame(() => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        el.querySelectorAll('.landing-reveal').forEach((node) => node.classList.add('visible'));
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
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
      );

      el.querySelectorAll('.landing-reveal').forEach((node) => observer.observe(node));

      // Store for cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).__faqObserver = observer;
    });

    return () => {
      cancelAnimationFrame(raf);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((el as any).__faqObserver) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).__faqObserver.disconnect();
      }
    };
  }, [faqs]);

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const getLocalized = (item: FaqItem, type: 'q' | 'a') => {
    const lang = i18n.language || 'en';
    const mapping = LANG_MAP[lang] ?? LANG_MAP['en']!;
    const value = item[mapping[type]];
    if (value) return value as string;
    // Fallback to English
    const en = LANG_MAP['en']!;
    return item[en[type]] as string;
  };

  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="landing-section" ref={sectionRef}>
      <div className="landing-container">
        <div className="landing-section-header landing-reveal">
          <h2>
            {t('landing.faq.title')}{' '}
            <span className="landing-gradient-text">{t('landing.faq.titleHighlight')}</span>
          </h2>
          <p>{t('landing.faq.subtitle')}</p>
        </div>

        <div className="landing-faq-list landing-reveal">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`landing-faq-item${isOpen ? ' landing-faq-item-open' : ''}`}
              >
                <button
                  className="landing-faq-question"
                  onClick={() => toggle(faq.id)}
                  aria-expanded={isOpen}
                >
                  <span>{getLocalized(faq, 'q')}</span>
                  <ChevronDown className={`landing-faq-chevron${isOpen ? ' open' : ''}`} />
                </button>
                <div className={`landing-faq-answer${isOpen ? ' open' : ''}`}>
                  <p>{getLocalized(faq, 'a')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
