import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import {
  Send,
  ChevronDown,
  MessageCircle,
  HelpCircle,
  Mail,
  User,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
} from 'lucide-react';

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

/* ─── Component ────────────────────────────────────────────── */

export function SupportPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  const [name, setName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const FAQ_KEYS = ['0', '1', '2', '3', '4', '5'] as const;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      await apiClient.post('/support-contact', {
        name,
        email,
        subject,
        message,
      });
      setSuccess(t('support.form.success'));
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
          {/* ─── Contact Form (3 cols) ──────────────────────── */}
          <div
            className="lg:col-span-3 glass-card"
            style={{ padding: '1.75rem' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: 'var(--radius-xs)',
                  background: 'linear-gradient(135deg, var(--color-brand-primary), #7c6cf0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px var(--color-brand-glow)',
                }}
              >
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {t('support.form.title')}
                </h2>
              </div>
            </div>

            {/* Status messages */}
            {error && (
              <div
                className="flex items-center gap-2 p-3 mb-5 rounded text-sm"
                style={{
                  background: 'rgba(255, 107, 107, 0.08)',
                  border: '1px solid rgba(255, 107, 107, 0.2)',
                  color: 'var(--color-error)',
                  animation: 'support-success-in 0.3s ease',
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                className="flex items-center gap-2 p-3 mb-5 rounded text-sm"
                style={{
                  background: 'rgba(0, 206, 201, 0.08)',
                  border: '1px solid rgba(0, 206, 201, 0.15)',
                  color: 'var(--color-success)',
                  animation: 'support-success-in 0.3s ease',
                }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="support-name"
                    className="flex items-center gap-1.5 text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <User className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                    {t('support.form.name')}
                  </label>
                  <input
                    id="support-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="support-email"
                    className="flex items-center gap-1.5 text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <Mail className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                    {t('support.form.email')}
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label
                  htmlFor="support-subject"
                  className="flex items-center gap-1.5 text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  {t('support.form.subject')}
                </label>
                <input
                  id="support-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('support.form.subjectPlaceholder')}
                  className="input-field"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="support-message"
                  className="flex items-center gap-1.5 text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <MessageCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  {t('support.form.message')}
                </label>
                <textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('support.form.messagePlaceholder')}
                  className="input-field"
                  style={{ minHeight: '140px', resize: 'vertical' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="btn btn-primary w-full"
                style={{ padding: '0.875rem 1.5rem' }}
              >
                {sending ? (
                  <>
                    <div
                      style={{
                        width: '1rem',
                        height: '1rem',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                      }}
                    />
                    {t('support.form.sending')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('support.form.submit')}
                  </>
                )}
              </button>
            </form>

            {/* Response time note */}
            <div
              className="flex items-center justify-center gap-2 mt-5 text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Clock className="w-3.5 h-3.5" />
              {t('support.responseTime')}
            </div>
          </div>

          {/* ─── FAQ Section (2 cols) ───────────────────────── */}
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
              {FAQ_KEYS.map((key, i) => (
                <FaqItem
                  key={key}
                  index={i}
                  question={t(`support.faq.items.${key}.q`)}
                  answer={t(`support.faq.items.${key}.a`)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
