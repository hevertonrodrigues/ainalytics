import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY, STORAGE_KEYS } from '@/lib/constants';

/* ─── Types ───────────────────────────────────────────────── */

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  status: string;
}

/* ─── FAQ Accordion Item ───────────────────────────────────── */

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left group"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-xs)',
          background: open
            ? 'var(--color-bg-tertiary)'
            : 'transparent',
          border: `1px solid ${open ? 'var(--color-brand-primary)' : 'transparent'}`,
          marginBottom: '0.5rem',
          transition: 'all 0.25s ease',
        }}
        className="group-hover:bg-bg-tertiary"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: 'var(--radius-xs)',
                background: open
                  ? 'linear-gradient(135deg, var(--color-brand-primary), #7c6cf0)'
                  : 'var(--color-bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.25s ease',
                boxShadow: open ? '0 2px 12px var(--color-brand-glow)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: open ? '#fff' : 'var(--color-text-muted)',
                  transition: 'color 0.25s ease',
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <span
              className="text-sm font-medium transition-colors"
              style={{
                color: open
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
              }}
            >
              {question}
            </span>
          </div>
          <ChevronDown
            className="shrink-0 transition-transform duration-200"
            style={{
              width: '1rem',
              height: '1rem',
              color: open ? 'var(--color-brand-secondary)' : 'var(--color-text-muted)',
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        </div>

        <div
          style={{
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            maxHeight: open ? '300px' : '0',
            opacity: open ? 1 : 0,
            marginTop: open ? '0.75rem' : '0',
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{
              color: 'var(--color-text-secondary)',
              paddingLeft: '2.75rem',
            }}
          >
            {answer}
          </p>
        </div>
      </div>
    </button>
  );
}

/* ─── FAQ Section Component ────────────────────────────────── */

const LANG_MAP: Record<string, string> = { en: 'en', 'pt-br': 'pt', es: 'es' };

export function FaqSection() {
  const { t, i18n } = useTranslation();
  const [faqItems, setFaqItems] = useState<FaqRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaq = async () => {
      setLoading(true);
      try {
        const lang = LANG_MAP[i18n.language?.toLowerCase()] || 'en';
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

        const headers: Record<string, string> = {
          apikey: SUPABASE_ANON_KEY,
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(
          `${EDGE_FUNCTION_BASE}/faq?lang=${lang}`,
          { headers },
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setFaqItems(json.data);
        }
      } catch {
        // Silently fail — FAQ section will simply be empty
      } finally {
        setLoading(false);
      }
    };
    fetchFaq();
  }, [i18n.language]);

  return (
    <div
      className="lg:col-span-2 glass-card"
      style={{ padding: '1.75rem' }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          style={{
            width: '2.25rem',
            height: '2.25rem',
            borderRadius: 'var(--radius-xs)',
            background: 'linear-gradient(135deg, var(--color-brand-accent), #e84393)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(253, 121, 168, 0.25)',
          }}
        >
          <HelpCircle className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">
          {t('support.faq.title')}
        </h2>
      </div>

      <div>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '3.25rem',
                borderRadius: 'var(--radius-xs)',
                background: 'var(--color-bg-tertiary)',
                marginBottom: '0.5rem',
                opacity: 0.5,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))
        ) : faqItems.length > 0 ? (
          faqItems.map((item, i) => (
            <FaqItem
              key={item.id}
              index={i}
              question={item.question}
              answer={item.answer}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}
