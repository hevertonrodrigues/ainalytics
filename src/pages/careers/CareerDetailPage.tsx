import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, MapPin, FileText, Building2, Briefcase,
  Upload, CheckCircle2, AlertCircle,
  User, Mail, Linkedin,
} from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/constants';
import { LandingHeader } from '@/pages/landing/LandingHeader';
import { LandingFooter } from '@/pages/landing/LandingFooter';
import { executeRecaptcha } from '@/lib/recaptcha';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import { useForceLightTheme } from '@/hooks/useForceLightTheme';
import { useSeo, jobPosting, breadcrumbList, SITE_URL } from '@/lib/seo';
import type { Iso2 } from 'intl-tel-input/data';

const LANGUAGE_COUNTRY_MAP: Record<string, Iso2> = {
  'pt-br': 'br',
  'es': 'es',
  'en': 'us',
};

/* ─── Types ────────────────────────────────────────────── */

interface Question {
  id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
}

interface Opportunity {
  id: string;
  slug: string;
  title: string;
  department: string | null;
  location: string | null;
  contract_type: string | null;
  compensation: string | null;
  description_md: string;
  published_at: string;
  questions: Question[];
}

/* ─── Markdown renderer (simple) ───────────────────────── */

function renderMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Single newline
    .replace(/\n/g, '<br/>');

  html = `<p>${html}</p>`;
  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
}

/* ─── Component ────────────────────────────────────────── */

export function CareerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  useForceLightTheme();
  const [scrolled, setScrolled] = useState(false);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // SEO / GEO — JobPosting schema lets Google for Jobs surface this
  // role and gives ChatGPT/Claude/Perplexity extractable hiring info.
  // Only emits JSON-LD once the opportunity is loaded.
  const jobUrl = opportunity ? `${SITE_URL}/careers/${opportunity.slug}` : `${SITE_URL}/careers`;
  const plainDescription = opportunity?.description_md
    ? opportunity.description_md.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 480)
    : '';
  const isRemote = (opportunity?.location || '').toLowerCase().includes('remote');
  useSeo({
    title: opportunity ? `${opportunity.title} · Careers · Ainalytics` : 'Careers · Ainalytics',
    description: opportunity
      ? `${opportunity.title}${opportunity.location ? ` — ${opportunity.location}` : ''}. ${plainDescription}`.slice(0, 300)
      : 'Open position at Ainalytics.',
    canonical: jobUrl,
    robots: opportunity ? 'index,follow' : 'noindex,follow',
    og: { type: 'article', siteName: 'Ainalytics' },
    jsonLd: opportunity
      ? [
          jobPosting({
            title: opportunity.title,
            description: plainDescription || opportunity.title,
            url: jobUrl,
            datePosted: opportunity.published_at,
            employmentType:
              opportunity.contract_type?.toLowerCase().includes('part') ? 'PART_TIME' :
              opportunity.contract_type?.toLowerCase().includes('contract') ? 'CONTRACTOR' :
              opportunity.contract_type?.toLowerCase().includes('intern') ? 'INTERN' :
              'FULL_TIME',
            remote: isRemote,
            city: !isRemote ? (opportunity.location || undefined) : undefined,
          }),
          breadcrumbList([
            { name: 'Ainalytics', url: SITE_URL },
            { name: 'Careers', url: `${SITE_URL}/careers` },
            { name: opportunity.title, url: jobUrl },
          ]),
        ]
      : [],
  });

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/public-careers/${slug}`, {
          headers: { apikey: SUPABASE_ANON_KEY },
        });
        const json = await res.json();
        if (json.success && json.data) {
          setOpportunity(json.data);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      setError(t('careers.form.errors.invalidFileType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('careers.form.errors.fileTooLarge'));
      return;
    }
    setError('');
    setResumeFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || ''); // Remove data:xxx;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const isPhoneInvalid = phoneTouched && phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!opportunity) return;

    // Validate phone
    if (!phone || getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      setError(t('careers.form.errors.phoneRequired'));
      setPhoneTouched(true);
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const recaptcha_token = await executeRecaptcha('careers_apply');

      let resume_base64: string | null = null;
      let resume_filename: string | null = null;
      let resume_content_type: string | null = null;

      if (resumeFile) {
        resume_base64 = await fileToBase64(resumeFile);
        resume_filename = resumeFile.name;
        resume_content_type = resumeFile.type;
      }

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-careers/${slug}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            full_name: fullName,
            email,
            phone: phone || undefined,
            linkedin_url: linkedinUrl || undefined,
            resume_base64,
            resume_filename,
            resume_content_type,
            answers,
            recaptcha_token,
          }),
        },
      );

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to submit');
      }

      setSuccess(true);
      // Scroll to top after success
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('careers.form.errors.generic');
      setError(msg);
      setTimeout(() => setError(''), 6000);
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  return (
    <div className="landing-page">
      <LandingHeader scrolled={scrolled} />

      <style>{`
        @keyframes cd-fade-up {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cd-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-10px, -40px) scale(1.1); }
          75% { transform: translate(-30px, -15px) scale(1.02); }
        }
        @keyframes cd-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(1.08); }
          66% { transform: translate(15px, -25px) scale(0.95); }
        }
        @keyframes cd-success-pop {
          0% { opacity: 0; transform: scale(0.9); }
          50% { transform: scale(1.02); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cd-hero {
          position: relative;
          padding-top: 7rem;
          padding-bottom: 4rem;
          min-height: 100vh;
          overflow: hidden;
        }
        .cd-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 0%, rgba(108,92,231,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 100%, rgba(253,121,168,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(0,206,201,0.04) 0%, transparent 60%);
          pointer-events: none;
        }
        .cd-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .cd-back {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 1.5rem;
          transition: color 0.2s ease;
          animation: cd-fade-up 0.4s ease both;
        }
        .cd-back:hover { color: var(--color-brand-primary); }
        .cd-back svg { width: 1rem; height: 1rem; }
        .cd-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2.5rem;
          align-items: start;
        }
        @media (max-width: 960px) {
          .cd-layout { grid-template-columns: 1fr; }
        }
        .cd-content {
          animation: cd-fade-up 0.5s ease both;
        }
        .cd-content-card {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          padding: 2.25rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          backdrop-filter: blur(16px);
        }
        .cd-content-card::before {
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
        @keyframes contact-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cd-title {
          font-size: clamp(1.5rem, 3.5vw, 2rem);
          font-weight: 800;
          font-family: var(--font-display);
          color: var(--color-text-primary);
          margin-bottom: 1.25rem;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .cd-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.625rem;
          margin-bottom: 2rem;
        }
        .cd-meta-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.35rem 0.875rem;
          border-radius: 100px;
          background: rgba(108,92,231,0.08);
          border: 1px solid rgba(108,92,231,0.15);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-brand-secondary, #a29bfe);
        }
        .cd-meta-tag svg { width: 0.75rem; height: 0.75rem; }
        .cd-markdown {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          line-height: 1.8;
        }
        .cd-markdown h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          font-family: var(--font-display);
        }
        .cd-markdown h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .cd-markdown ul {
          list-style: none;
          padding: 0;
          margin: 0.75rem 0;
        }
        .cd-markdown li {
          position: relative;
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--color-text-secondary);
        }
        .cd-markdown li::before {
          content: '→';
          position: absolute;
          left: 0;
          color: var(--color-brand-primary);
          font-weight: 600;
        }
        .cd-markdown strong {
          color: var(--color-text-primary);
          font-weight: 600;
        }
        .cd-form-panel {
          position: sticky;
          top: 6rem;
          animation: cd-fade-up 0.5s ease 0.15s both;
        }
        .cd-form-card {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          padding: 2rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
          backdrop-filter: blur(16px);
        }
        .cd-form-card::after {
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
        .cd-form-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          font-family: var(--font-display);
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .cd-form-title svg {
          width: 1.125rem;
          height: 1.125rem;
          color: var(--color-brand-primary);
        }
        .cd-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-xs, 10px);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-glass-border);
          color: var(--color-text-primary);
          font-size: 0.875rem;
          font-family: var(--font-body, inherit);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          outline: none;
          box-sizing: border-box;
        }
        .cd-input:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px var(--color-brand-glow, rgba(108,92,231,0.15));
        }
        .cd-input::placeholder {
          color: var(--color-text-muted);
        }
        textarea.cd-input {
          min-height: 80px;
          resize: vertical;
        }
        select.cd-input {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 5L6 8L9 5' stroke='%239898b0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2rem;
        }
        .cd-file-input {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-xs, 10px);
          background: var(--color-bg-secondary);
          border: 1px dashed var(--color-glass-border);
          cursor: pointer;
          transition: border-color 0.2s ease;
        }
        .cd-file-input:hover {
          border-color: var(--color-brand-primary);
        }
        .cd-file-input input {
          display: none;
        }
        .cd-file-input-icon {
          width: 2rem;
          height: 2rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(108,92,231,0.1);
          color: var(--color-brand-primary);
          flex-shrink: 0;
        }
        .cd-file-input-text {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          line-height: 1.4;
        }
        .cd-file-input-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-brand-primary);
        }
        .cd-divider {
          height: 1px;
          background: var(--color-glass-border);
          margin: 1.5rem 0;
        }
        .cd-alert {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.8125rem;
          font-weight: 500;
          margin-bottom: 1rem;
        }
        .cd-alert svg { width: 1rem; height: 1rem; flex-shrink: 0; }
        .cd-alert-error {
          background: rgba(255,107,107,0.1);
          border: 1px solid rgba(255,107,107,0.2);
          color: #ff6b6b;
        }
        .cd-success-card {
          text-align: center;
          padding: 3rem 2rem;
          animation: cd-success-pop 0.5s ease both;
        }
        .cd-success-icon {
          width: 4rem;
          height: 4rem;
          margin: 0 auto 1.25rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(0,206,201,0.15), rgba(0,206,201,0.05));
        }
        .cd-success-icon svg { width: 2rem; height: 2rem; color: #00cec9; }
        .cd-success-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text-primary);
          font-family: var(--font-display);
          margin-bottom: 0.75rem;
        }
        .cd-success-text {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          line-height: 1.6;
          max-width: 400px;
          margin: 0 auto 1.5rem;
        }
        .cd-skeleton-block {
          border-radius: 16px;
          padding: 2.25rem;
          background: var(--color-glass-bg);
          border: 1px solid var(--color-glass-border);
        }
        .cd-skeleton-line {
          height: 1rem;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--color-glass-bg), var(--color-glass-hover, rgba(255,255,255,0.06)), var(--color-glass-bg));
          background-size: 200% 100%;
          animation: cd-shimmer 1.5s ease infinite;
          margin-bottom: 0.75rem;
        }
        @keyframes cd-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .cd-not-found {
          text-align: center;
          padding: 6rem 2rem;
          animation: cd-fade-up 0.5s ease both;
        }
        .cd-questions-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>

      <section className="cd-hero">
        {/* Floating orbs */}
        <div
          className="cd-orb"
          style={{
            width: '300px', height: '300px',
            background: 'var(--color-brand-primary)',
            top: '5%', left: '-5%',
            opacity: 0.1,
            animation: 'cd-float-1 20s ease-in-out infinite',
          }}
        />
        <div
          className="cd-orb"
          style={{
            width: '200px', height: '200px',
            background: 'var(--color-brand-accent, #fd79a8)',
            bottom: '10%', right: '-3%',
            opacity: 0.08,
            animation: 'cd-float-2 16s ease-in-out infinite',
          }}
        />

        <div className="landing-container" style={{ position: 'relative', zIndex: 1, maxWidth: '1100px' }}>
          <Link to="/careers" className="cd-back">
            <ArrowLeft /> {t('careers.backToList')}
          </Link>

          {/* Loading state */}
          {loading && (
            <div className="cd-layout">
              <div>
                <div className="cd-skeleton-block">
                  <div className="cd-skeleton-line" style={{ width: '70%', height: '1.5rem' }} />
                  <div className="cd-skeleton-line" style={{ width: '100%' }} />
                  <div className="cd-skeleton-line" style={{ width: '90%' }} />
                  <div className="cd-skeleton-line" style={{ width: '80%' }} />
                  <div className="cd-skeleton-line" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="cd-skeleton-block">
                  <div className="cd-skeleton-line" style={{ width: '50%', height: '1.25rem' }} />
                  <div className="cd-skeleton-line" style={{ width: '100%' }} />
                  <div className="cd-skeleton-line" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Not found */}
          {notFound && (
            <div className="cd-not-found">
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                {t('careers.notFound.title')}
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                {t('careers.notFound.description')}
              </p>
              <Link to="/careers" className="btn btn-primary">
                {t('careers.notFound.backButton')}
              </Link>
            </div>
          )}

          {/* Opportunity detail + form */}
          {!loading && !notFound && opportunity && (
            <div className="cd-layout">
              {/* Left: Job description */}
              <div className="cd-content">
                <div className="cd-content-card">
                  <h1 className="cd-title">{opportunity.title}</h1>

                  <div className="cd-meta">
                    {opportunity.department && (
                      <span className="cd-meta-tag"><Building2 /> {opportunity.department}</span>
                    )}
                    {opportunity.location && (
                      <span className="cd-meta-tag"><MapPin /> {opportunity.location}</span>
                    )}
                    {opportunity.contract_type && (
                      <span className="cd-meta-tag"><FileText /> {opportunity.contract_type}</span>
                    )}
                    {opportunity.compensation && (
                      <span className="cd-meta-tag"><Briefcase /> {opportunity.compensation}</span>
                    )}
                  </div>

                  <div
                    className="cd-markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(opportunity.description_md) }}
                  />
                </div>
              </div>

              {/* Right: Application form */}
              <div className="cd-form-panel">
                {success ? (
                  <div className="cd-form-card cd-success-card">
                    <div className="cd-success-icon">
                      <CheckCircle2 />
                    </div>
                    <h3 className="cd-success-title">{t('careers.form.success.title')}</h3>
                    <p className="cd-success-text">{t('careers.form.success.description')}</p>
                    <Link to="/careers" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                      {t('careers.form.success.backButton')}
                    </Link>
                  </div>
                ) : (
                  <div className="cd-form-card">
                    <h3 className="cd-form-title">
                      {t('careers.form.title')}
                    </h3>

                    {error && (
                      <div className="cd-alert cd-alert-error">
                        <AlertCircle /> {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form auth-form--elevated">
                      {/* Personal info */}
                      <div className="auth-field">
                        <label htmlFor="careers-name">
                          {t('careers.form.fullName')} <span className="text-error">*</span>
                        </label>
                        <div className="auth-input-wrap">
                          <User className="auth-input-icon" />
                          <input
                            id="careers-name"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            placeholder={t('careers.form.fullNamePlaceholder')}
                            autoComplete="name"
                          />
                        </div>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="careers-email">
                          {t('careers.form.email')} <span className="text-error">*</span>
                        </label>
                        <div className="auth-input-wrap">
                          <Mail className="auth-input-icon" />
                          <input
                            id="careers-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder={t('careers.form.emailPlaceholder')}
                            autoComplete="email"
                          />
                        </div>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="careers-phone">
                          {t('careers.form.phone')} <span className="text-error">*</span>
                        </label>
                        <div className="auth-input-wrap">
                          <PhoneInput
                            id="careers-phone"
                            value={phone}
                            onChange={(val) => {
                              setPhone(val);
                              setPhoneTouched(false);
                            }}
                            onBlur={() => setPhoneTouched(true)}
                            defaultCountry={LANGUAGE_COUNTRY_MAP[i18n.language] || 'auto'}
                            required
                            placeholder={t('careers.form.phonePlaceholder')}
                            className={isPhoneInvalid ? 'border-error' : ''}
                          />
                        </div>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="careers-linkedin">
                          {t('careers.form.linkedin')}
                        </label>
                        <div className="auth-input-wrap">
                          <Linkedin className="auth-input-icon" />
                          <input
                            id="careers-linkedin"
                            type="url"
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            placeholder={t('careers.form.linkedinPlaceholder')}
                            autoComplete="url"
                          />
                        </div>
                      </div>

                      {/* Resume upload */}
                      <div className="auth-field">
                        <label>{t('careers.form.resume')}</label>
                        <label className="cd-file-input">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                          />
                          <div className="cd-file-input-icon">
                            <Upload style={{ width: '1rem', height: '1rem' }} />
                          </div>
                          {resumeFile ? (
                            <span className="cd-file-input-name">{resumeFile.name}</span>
                          ) : (
                            <span className="cd-file-input-text">
                              {t('careers.form.resumePlaceholder')}
                            </span>
                          )}
                        </label>
                      </div>

                      {/* Custom questions */}
                      {opportunity.questions.length > 0 && (
                        <>
                          <div className="cd-divider" />
                          <h4 className="cd-questions-title">{t('careers.form.questionsTitle')}</h4>

                          {opportunity.questions.map((q) => (
                            <div key={q.id} className="auth-field">
                              <label>
                                {q.question_text}
                                {q.is_required && <span className="text-error">*</span>}
                              </label>

                              {q.question_type === 'text' && (
                                <div className="auth-input-wrap">
                                  <input
                                    type="text"
                                    value={answers[q.id] || ''}
                                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                                    required={q.is_required}
                                    style={{ paddingLeft: '0.875rem' }}
                                  />
                                </div>
                              )}

                              {q.question_type === 'textarea' && (
                                <textarea
                                  className="cd-input"
                                  value={answers[q.id] || ''}
                                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                                  required={q.is_required}
                                  rows={3}
                                />
                              )}

                              {q.question_type === 'select' && (
                                <select
                                  className="cd-input"
                                  value={answers[q.id] || ''}
                                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                                  required={q.is_required}
                                >
                                  <option value="">{t('careers.form.selectPlaceholder')}</option>
                                  {(q.options || []).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              )}

                              {q.question_type === 'radio' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  {(q.options || []).map((opt) => (
                                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                      <input
                                        type="radio"
                                        name={q.id}
                                        value={opt}
                                        checked={answers[q.id] === opt}
                                        onChange={(e) => updateAnswer(q.id, e.target.value)}
                                        required={q.is_required}
                                      />
                                      {opt}
                                    </label>
                                  ))}
                                </div>
                              )}

                              {q.question_type === 'checkbox' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  {(q.options || []).map((opt) => {
                                    const selected = (answers[q.id] || '').split(',').filter(Boolean);
                                    const isChecked = selected.includes(opt);
                                    return (
                                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const newValue = isChecked
                                              ? selected.filter((s) => s !== opt).join(',')
                                              : [...selected, opt].join(',');
                                            updateAnswer(q.id, newValue);
                                          }}
                                        />
                                        {opt}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}

                      <button
                        type="submit"
                        className="auth-submit"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="auth-spinner" />
                        ) : (
                          t('careers.form.submit')
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
