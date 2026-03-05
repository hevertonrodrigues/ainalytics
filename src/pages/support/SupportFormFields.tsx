import { type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchSelect } from '@/components/ui/SearchSelect';
import {
  Send,
  MessageCircle,
  Mail,
  User,
  FileText,
  CheckCircle2,
} from 'lucide-react';

/* ─── Props ────────────────────────────────────────────────── */

export interface SupportFormFieldsProps {
  name: string;
  onNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  subjectOptions: { value: string; label: string }[];
  message: string;
  onMessageChange: (v: string) => void;
  sending: boolean;
  error: string;
  success: string;
  onSubmit: (e: FormEvent) => void;
  /** Optional slot rendered between the message textarea and the submit button (e.g. file upload) */
  children?: ReactNode;
  /** Whether to show the card wrapper with header — default true */
  showCardWrapper?: boolean;
  /** Override title i18n key */
  titleKey?: string;
}

/* ─── Shared Form Fields Component ─────────────────────────── */

export function SupportFormFields({
  name,
  onNameChange,
  email,
  onEmailChange,
  subject,
  onSubjectChange,
  subjectOptions,
  message,
  onMessageChange,
  sending,
  error,
  success,
  onSubmit,
  children,
  showCardWrapper = true,
  titleKey = 'support.form.title',
}: SupportFormFieldsProps) {
  const { t } = useTranslation();

  const content = (
    <>
      {/* Card header */}
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
            {t(titleKey)}
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

      <form onSubmit={onSubmit} className="space-y-5">
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
              onChange={(e) => onNameChange(e.target.value)}
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
              onChange={(e) => onEmailChange(e.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label
            className="flex items-center gap-1.5 text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
            {t('support.form.subject')}
          </label>
          <SearchSelect
            id="support-subject"
            options={subjectOptions}
            value={subject}
            onChange={onSubjectChange}
            placeholder={t('support.form.subjectPlaceholder')}
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
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder={t('support.form.messagePlaceholder')}
            className="input-field"
            style={{ minHeight: '140px', resize: 'vertical' }}
            required
          />
        </div>

        {/* Optional slot (file upload, etc.) */}
        {children}

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
    </>
  );

  if (!showCardWrapper) return content;

  return (
    <div
      className="lg:col-span-3 glass-card"
      style={{ padding: '1.75rem' }}
    >
      {content}
    </div>
  );
}
