import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/constants';
import { LandingHeader } from '@/pages/landing/LandingHeader';
import { LandingFooter } from '@/pages/landing/LandingFooter';
import { SupportFormFields } from '@/pages/support/SupportFormFields';

/* ─── Constants ────────────────────────────────────────────── */

const PUBLIC_SUBJECT_KEYS = [
  'general_inquiry',
  'pricing',
  'partnership',
  'demo_request',
  'other',
] as const;

/* ─── Public Contact Page ──────────────────────────────────── */

export function ContactPage() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const subjectOptions = PUBLIC_SUBJECT_KEYS.map((key) => ({
    value: key,
    label: t(`contactPage.subjects.${key}`),
  }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to send');
      }

      setSuccess(t('support.form.success'));
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setTimeout(() => setSuccess(''), 5000);
    } catch {
      setError(t('support.form.error'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="landing-page">
      <LandingHeader scrolled={scrolled} />

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

      <section
        style={{
          paddingTop: '7rem',
          paddingBottom: '4rem',
          minHeight: '100vh',
        }}
      >
        <div className="landing-container" style={{ maxWidth: '720px' }}>
          {/* ─── Hero Header ──────────────────────────── */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--radius-xs)',
              padding: '3rem 2rem',
              textAlign: 'center',
              background: 'var(--color-glass-bg)',
              border: '1px solid var(--color-glass-border)',
              marginBottom: '2rem',
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
            <div
              style={{
                position: 'absolute',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'var(--color-brand-primary)',
                top: '-30px',
                left: '10%',
                filter: 'blur(84px)',
                opacity: 0.2,
                animation: 'support-float 8s ease-in-out 0s infinite alternate',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--color-brand-accent)',
                top: '60%',
                left: '85%',
                filter: 'blur(56px)',
                opacity: 0.2,
                animation: 'support-float 8s ease-in-out 2s infinite alternate',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
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
                {t('contactPage.title')}
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
                {t('contactPage.subtitle')}
              </p>
            </div>
          </div>

          {/* ─── Contact Form ─────────────────────────── */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            <SupportFormFields
              name={name}
              onNameChange={setName}
              email={email}
              onEmailChange={setEmail}
              subject={subject}
              onSubjectChange={setSubject}
              subjectOptions={subjectOptions}
              message={message}
              onMessageChange={setMessage}
              sending={sending}
              error={error}
              success={success}
              onSubmit={handleSubmit}
              showCardWrapper={false}
              titleKey="contactPage.formTitle"
            />
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
