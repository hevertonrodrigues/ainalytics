import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { ContactForm } from './ContactForm';
import { FaqSection } from './FaqSection';

/* ─── Decorative Floating Orb ──────────────────────────────── */

function FloatingOrb({
  size,
  color,
  top,
  left,
  delay,
}: {
  size: number;
  color: string;
  top: string;
  left: string;
  delay: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color,
        top,
        left,
        filter: `blur(${size * 0.7}px)`,
        opacity: 0.2,
        animation: `support-float 8s ease-in-out ${delay}s infinite alternate`,
        pointerEvents: 'none',
      }}
    />
  );
}

/* ─── Support Page ─────────────────────────────────────────── */

export function SupportPage() {
  const { t } = useTranslation();

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes support-float {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-20px) scale(1.1); }
        }
        @keyframes support-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes support-success-in {
          0% { transform: translateY(-8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="stagger-enter max-w-5xl mx-auto space-y-8">
        {/* ─── Hero Header ──────────────────────────────────── */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-xs)',
            padding: '3rem 2rem',
            textAlign: 'center',
            background: 'var(--color-glass-bg)',
            border: '1px solid var(--color-glass-border)',
          }}
        >
          {/* Animated background gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(253,121,168,0.05) 50%, rgba(0,206,201,0.06) 100%)',
              backgroundSize: '200% 200%',
              animation: 'support-gradient-shift 12s ease infinite',
              pointerEvents: 'none',
            }}
          />

          {/* Floating orbs */}
          <FloatingOrb size={120} color="var(--color-brand-primary)" top="-30px" left="10%" delay={0} />
          <FloatingOrb size={80} color="var(--color-brand-accent)" top="60%" left="85%" delay={2} />
          <FloatingOrb size={60} color="var(--color-success)" top="20%" left="75%" delay={4} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Icon badge */}
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-brand-primary), #7c6cf0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                boxShadow: '0 8px 32px var(--color-brand-glow)',
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>

            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              {t('support.title')}
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.9375rem',
                maxWidth: '480px',
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              {t('support.subtitle')}
            </p>
          </div>
        </div>

        {/* ─── Main Content Grid ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <ContactForm />
          <FaqSection />
        </div>
      </div>
    </>
  );
}
