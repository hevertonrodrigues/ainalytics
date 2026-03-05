import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY, STORAGE_KEYS } from '@/lib/constants';
import { SearchSelect } from '@/components/ui/SearchSelect';
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
  Upload,
  X,
  Film,
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

/* ─── Constants ────────────────────────────────────────────── */

const SUBJECT_KEYS = [
  'bug_report',
  'account_billing',
  'feature_request',
  'data_results',
  'integrations',
  'other',
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILES = 5;

/* ─── Component ────────────────────────────────────────────── */

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  status: string;
}

export function SupportPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const [name, setName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [faqItems, setFaqItems] = useState<FaqRow[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);

  // Map i18n locale to the lang param the edge function expects
  const langMap: Record<string, string> = { en: 'en', 'pt-br': 'pt', es: 'es' };

  useEffect(() => {
    const fetchFaq = async () => {
      setFaqLoading(true);
      try {
        const lang = langMap[i18n.language?.toLowerCase()] || 'en';
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
        setFaqLoading(false);
      }
    };
    fetchFaq();
  }, [i18n.language]);

  const subjectOptions = SUBJECT_KEYS.map((key) => ({
    value: key,
    label: t(`support.form.subjects.${key}`),
  }));

  // ─── File handling ──────────────────────────────────────

  const validateAndAddFiles = useCallback((incoming: FileList | File[]) => {
    const valid: File[] = [];
    const errors: string[] = [];

    Array.from(incoming).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: ${t('support.form.fileTypeError')}`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ${t('support.form.fileSizeError')}`);
      } else {
        valid.push(file);
      }
    });

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        errors.push(t('support.form.fileMaxError', { max: MAX_FILES }));
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });

    if (errors.length) {
      setError(errors.join(' '));
      setTimeout(() => setError(''), 5000);
    }
  }, [t]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }, [validateAndAddFiles]);

  // ─── Submit ─────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      // Upload files to Supabase Storage
      const attachments: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `support/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error(uploadError.message);
        attachments.push(path);
      }

      await apiClient.post('/support-contact', {
        name,
        email,
        subject,
        message,
        attachments,
      });
      setSuccess(t('support.form.success'));
      setSubject('');
      setMessage('');
      setFiles([]);
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
                  onChange={setSubject}
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
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('support.form.messagePlaceholder')}
                  className="input-field"
                  style={{ minHeight: '140px', resize: 'vertical' }}
                  required
                />
              </div>

              {/* File Upload */}
              <div>
                <label
                  className="flex items-center gap-1.5 text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <Upload className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  {t('support.form.attachments')}
                  <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
                    ({t('support.form.attachmentsHint')})
                  </span>
                </label>

                {/* Drop zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-xs)',
                    border: `1.5px dashed ${dragActive ? 'var(--color-brand-primary)' : 'var(--color-glass-border)'}`,
                    background: dragActive ? 'rgba(108, 92, 231, 0.06)' : 'var(--color-bg-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files?.length) validateAndAddFiles(e.target.files);
                      e.target.value = '';
                    }}
                    style={{ display: 'none' }}
                  />
                  <Upload
                    className="mx-auto mb-2"
                    style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-text-muted)' }}
                  />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('support.form.dropzoneText')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {t('support.form.dropzoneHint')}
                  </p>
                </div>

                {/* File previews */}
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {files.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        style={{
                          position: 'relative',
                          width: '4.5rem',
                          height: '4.5rem',
                          borderRadius: 'var(--radius-xs)',
                          overflow: 'hidden',
                          border: '1px solid var(--color-glass-border)',
                          background: 'var(--color-bg-tertiary)',
                        }}
                      >
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Film className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '1.25rem',
                            height: '1.25rem',
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.65)',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X style={{ width: '0.7rem', height: '0.7rem', color: '#fff' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
              {faqLoading ? (
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
        </div>
      </div>
    </>
  );
}
