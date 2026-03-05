import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Send, ChevronDown, MessageCircle, HelpCircle } from 'lucide-react';

// ─── FAQ Accordion Item ─────────────────────────────────────

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-glass-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 px-1 text-left group"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-sm font-medium text-text-primary group-hover:text-brand-secondary transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: open ? '500px' : '0',
          opacity: open ? 1 : 0,
        }}
      >
        <p className="text-sm text-text-secondary px-1 pb-4 leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────

export function SupportPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // Form state
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
      // Simulated — wire to edge function when ready
      await new Promise((resolve) => setTimeout(resolve, 1200));
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
    <div className="stagger-enter max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t('support.title')}</h1>
        <p className="text-text-secondary mt-2 text-sm max-w-lg mx-auto">
          {t('support.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Contact Form ────────────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="w-5 h-5 text-brand-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              {t('support.form.title')}
            </h2>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 mb-4 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="support-name" className="block text-sm font-medium text-text-secondary mb-1.5">
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

            {/* Email */}
            <div>
              <label htmlFor="support-email" className="block text-sm font-medium text-text-secondary mb-1.5">
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

            {/* Subject */}
            <div>
              <label htmlFor="support-subject" className="block text-sm font-medium text-text-secondary mb-1.5">
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
              <label htmlFor="support-message" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('support.form.message')}
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('support.form.messagePlaceholder')}
                className="input-field min-h-[120px] resize-y"
                required
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn btn-primary w-full"
            >
              <Send className="w-4 h-4" />
              {sending ? t('support.form.sending') : t('support.form.submit')}
            </button>
          </form>
        </div>

        {/* ─── FAQ Section ─────────────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <HelpCircle className="w-5 h-5 text-brand-accent" />
            <h2 className="text-lg font-semibold text-text-primary">
              {t('support.faq.title')}
            </h2>
          </div>

          <div>
            {FAQ_KEYS.map((key) => (
              <FaqItem
                key={key}
                question={t(`support.faq.items.${key}.q`)}
                answer={t(`support.faq.items.${key}.a`)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-text-muted">
        {t('support.responseTime')}
      </p>
    </div>
  );
}
