import { useState, useRef, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { Upload, X, Film } from 'lucide-react';
import { SupportFormFields } from './SupportFormFields';

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

/* ─── Contact Form Component (Authenticated) ─────────────── */

export function ContactForm() {
  const { t } = useTranslation();
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
    >
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
    </SupportFormFields>
  );
}
