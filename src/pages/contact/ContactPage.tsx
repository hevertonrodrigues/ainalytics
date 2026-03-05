import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Mail,
  Clock,
  MessageSquare,
  ArrowUpRight,
  Headphones,
  Zap,
} from 'lucide-react';
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
          apikey: SUPABASE_ANON_KEY,
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

      {/* ─── Scoped Styles ────────────────────────── */}
      <style>{`
        @keyframes contact-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes contact-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-10px, -40px) scale(1.1); }
          75% { transform: translate(-30px, -15px) scale(1.02); }
        }
        @keyframes contact-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(1.08); }
          66% { transform: translate(15px, -25px) scale(0.95); }
        }
        @keyframes contact-float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(20px, -30px) rotate(5deg); }
        }
        @keyframes contact-fade-up {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes contact-pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(108, 92, 231, 0.2); }
          50% { box-shadow: 0 0 40px rgba(108, 92, 231, 0.4); }
        }
        .contact-hero-section {
          position: relative;
          padding-top: 7rem;
          padding-bottom: 4rem;
          min-height: 100vh;
          overflow: hidden;
        }
        .contact-hero-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 0%, rgba(108,92,231,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 100%, rgba(253,121,168,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(0,206,201,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .contact-layout {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 2.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .contact-layout { grid-template-columns: 1fr; }
        }
        .contact-info-panel {
          position: sticky;
          top: 6rem;
          animation: contact-fade-up 0.6s ease both;
        }
        .contact-info-card {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-sm, 12px);
          padding: 2.25rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          backdrop-filter: blur(16px);
        }
        .contact-info-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--color-brand-primary), var(--color-brand-accent, #fd79a8), var(--color-brand-primary));
          background-size: 200% 100%;
          animation: contact-gradient-shift 4s ease infinite;
        }
        .contact-channel {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem 0;
        }
        .contact-channel + .contact-channel {
          border-top: 1px solid var(--color-glass-border);
        }
        .contact-channel-icon {
          width: 2.5rem;
          height: 2.5rem;
          min-width: 2.5rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .contact-channel:hover .contact-channel-icon {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(108, 92, 231, 0.3);
        }
        .contact-form-panel {
          animation: contact-fade-up 0.6s ease 0.15s both;
        }
        .contact-form-card {
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-sm, 12px);
          padding: 2rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          backdrop-filter: blur(16px);
        }
        .contact-form-card::after {
          content: '';
          position: absolute;
          bottom: -80px;
          right: -80px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: var(--color-brand-primary);
          filter: blur(100px);
          opacity: 0.06;
          pointer-events: none;
        }
        .contact-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .contact-trust-badges {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }
        .contact-trust-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.875rem;
          border-radius: 100px;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          transition: border-color 0.2s ease, color 0.2s ease;
        }
        .contact-trust-badge:hover {
          border-color: var(--color-brand-primary);
          color: var(--color-text-primary);
        }
        .contact-trust-badge svg {
          width: 0.875rem;
          height: 0.875rem;
          color: var(--color-brand-primary);
        }
      `}</style>

      {/* ─── Hero Section ─────────────────────────── */}
      <section className="contact-hero-section">
        {/* Floating orbs */}
        <div
          className="contact-orb"
          style={{
            width: '300px',
            height: '300px',
            background: 'var(--color-brand-primary)',
            top: '5%',
            left: '-5%',
            opacity: 0.12,
            animation: 'contact-float-1 20s ease-in-out infinite',
          }}
        />
        <div
          className="contact-orb"
          style={{
            width: '200px',
            height: '200px',
            background: 'var(--color-brand-accent, #fd79a8)',
            bottom: '10%',
            right: '-3%',
            opacity: 0.1,
            animation: 'contact-float-2 16s ease-in-out infinite',
          }}
        />
        <div
          className="contact-orb"
          style={{
            width: '150px',
            height: '150px',
            background: '#00cec9',
            top: '60%',
            left: '50%',
            opacity: 0.06,
            animation: 'contact-float-3 18s ease-in-out infinite',
          }}
        />

        <div
          className="landing-container"
          style={{ position: 'relative', zIndex: 1, maxWidth: '1100px' }}
        >
          {/* ─── Page Title ───────────────────────── */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: '3rem',
              animation: 'contact-fade-up 0.5s ease both',
            }}
          >

            <h1
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                marginBottom: '0.75rem',
                lineHeight: 1.2,
              }}
            >
              {t('contactPage.title')}
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '1rem',
                maxWidth: '520px',
                margin: '0 auto',
                lineHeight: 1.7,
              }}
            >
              {t('contactPage.subtitle')}
            </p>
          </div>

          {/* ─── Two-Column Layout ────────────────── */}
          <div className="contact-layout">
            {/* Left: Info Panel */}
            <div className="contact-info-panel">
              <div className="contact-info-card">
                {/* Channel: Email */}
                <div className="contact-channel">
                  <div
                    className="contact-channel-icon"
                    style={{
                      background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(108,92,231,0.05))',
                    }}
                  >
                    <Mail style={{ width: '1.125rem', height: '1.125rem', color: 'var(--color-brand-primary)' }} />
                  </div>
                  <div>
                    <h4
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {t('contactPage.channels.email.title')}
                    </h4>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {t('contactPage.channels.email.description')}
                    </p>
                  </div>
                </div>

                {/* Channel: Response Time */}
                <div className="contact-channel">
                  <div
                    className="contact-channel-icon"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,206,201,0.15), rgba(0,206,201,0.05))',
                    }}
                  >
                    <Clock style={{ width: '1.125rem', height: '1.125rem', color: '#00cec9' }} />
                  </div>
                  <div>
                    <h4
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {t('contactPage.channels.response.title')}
                    </h4>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {t('contactPage.channels.response.description')}
                    </p>
                  </div>
                </div>

                {/* Channel: Support */}
                <div className="contact-channel">
                  <div
                    className="contact-channel-icon"
                    style={{
                      background: 'linear-gradient(135deg, rgba(253,121,168,0.15), rgba(253,121,168,0.05))',
                    }}
                  >
                    <Headphones
                      style={{ width: '1.125rem', height: '1.125rem', color: 'var(--color-brand-accent, #fd79a8)' }}
                    />
                  </div>
                  <div>
                    <h4
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {t('contactPage.channels.support.title')}
                    </h4>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {t('contactPage.channels.support.description')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Contact Form */}
            <div className="contact-form-panel">
              <div className="contact-form-card">
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
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
