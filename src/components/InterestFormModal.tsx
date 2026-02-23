import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { EDGE_FUNCTION_BASE } from '@/lib/constants';

interface InterestFormModalProps {
  open: boolean;
  onClose: () => void;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InterestFormModal({ open, onClose }: InterestFormModalProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setMessage('');
      setStatus('idle');
      setErrorMsg('');
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const isValid = name.trim() && email.trim() && EMAIL_REGEX.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`${EDGE_FUNCTION_BASE}/interest-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          message: message.trim() || undefined,
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          page_url: window.location.href,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'Request failed');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="interest-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div className="interest-modal glass-card">
        {/* Header */}
        <div className="interest-modal-header">
          <div>
            <h2 className="interest-modal-title">{t('interestForm.title')}</h2>
            <p className="interest-modal-subtitle">{t('interestForm.subtitle')}</p>
          </div>
          <button
            className="interest-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="interest-modal-success">
            <CheckCircle className="w-12 h-12 text-success" />
            <h3>{t('interestForm.successTitle')}</h3>
            <p>{t('interestForm.successMessage')}</p>
            <button className="btn btn-primary" onClick={onClose}>
              {t('interestForm.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="interest-modal-form">
            {/* Error banner */}
            {status === 'error' && (
              <div className="interest-modal-error">
                <AlertCircle className="w-4 h-4" />
                {errorMsg || t('common.error')}
              </div>
            )}

            {/* Name */}
            <div className="interest-field">
              <label htmlFor="interest-name">
                {t('interestForm.name')} <span className="text-error">*</span>
              </label>
              <input
                id="interest-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('interestForm.namePlaceholder')}
                required
                autoFocus
              />
            </div>

            {/* Email */}
            <div className="interest-field">
              <label htmlFor="interest-email">
                {t('interestForm.email')} <span className="text-error">*</span>
              </label>
              <input
                id="interest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('interestForm.emailPlaceholder')}
                required
              />
            </div>

            {/* Phone */}
            <div className="interest-field">
              <label htmlFor="interest-phone">{t('interestForm.phone')}</label>
              <input
                id="interest-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('interestForm.phonePlaceholder')}
              />
            </div>

            {/* Company */}
            <div className="interest-field">
              <label htmlFor="interest-company">{t('interestForm.company')}</label>
              <input
                id="interest-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('interestForm.companyPlaceholder')}
              />
            </div>

            {/* Message */}
            <div className="interest-field">
              <label htmlFor="interest-message">{t('interestForm.message')}</label>
              <textarea
                id="interest-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('interestForm.messagePlaceholder')}
                rows={3}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!isValid || status === 'submitting'}
              style={status === 'submitting' ? { opacity: 0.6 } : undefined}
            >
              {status === 'submitting' ? (
                t('interestForm.sending')
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('interestForm.submit')}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
