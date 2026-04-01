import React, { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { trackActivity } from '@/lib/analytics';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import type { Iso2 } from 'intl-tel-input/data';
import { Mail, User, ArrowRight, Globe } from 'lucide-react';
import { isProfessionalEmail } from '@/lib/email';
import { executeRecaptcha } from '@/lib/recaptcha';
import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY } from '@/lib/constants';

const LANGUAGE_COUNTRY_MAP: Record<string, Iso2> = {
  'pt-br': 'br',
  'es': 'es',
  'en': 'us',
};

export type InterestLeadFormVariant = 'ebook' | 'free-analysis';

export interface InterestLeadFormProps {
  /** Controls field order, labels, opt-in, and analytics event name */
  variant: InterestLeadFormVariant;
  /** Override the submit button label */
  submitLabel?: string;
  /** Called after successful submission */
  onSuccess?: () => void;
}

/* ── Variant-specific configuration ── */

const VARIANT_CONFIG = {
  ebook: {
    eventType: 'ebook_lead_form',
    idPrefix: 'ebook',
    websiteRequired: false,
    showOptIn: true,
    // Field order: name → email → phone → website
    fieldOrder: ['name', 'email', 'phone', 'website'] as const,
    labels: {
      name: 'ebook.formName',
      email: 'ebook.formEmail',
      phone: 'ebook.formPhone',
      website: 'ebook.formWebsite',
    },
    placeholders: {
      name: 'ebook.formNamePlaceholder',
      email: 'ebook.formEmailPlaceholder',
      phone: 'ebook.formPhonePlaceholder',
      website: 'ebook.formWebsitePlaceholder',
    },
    defaultCta: 'ebook.formCta',
    optInKey: 'ebook.formOptIn',
    privacyKey: 'ebook.formPrivacy',
  },
  'free-analysis': {
    eventType: 'free_analysis_form',
    idPrefix: 'fa',
    websiteRequired: true,
    showOptIn: false,
    // Field order: name → website → email → phone
    fieldOrder: ['name', 'website', 'email', 'phone'] as const,
    labels: {
      name: 'auth.fullName',
      email: 'auth.email',
      phone: 'auth.phone',
      website: 'freeAnalysis.formWebsite',
    },
    placeholders: {
      name: 'auth.placeholderName',
      email: 'auth.placeholderEmail',
      phone: 'auth.placeholderPhone',
      website: 'freeAnalysis.formWebsitePlaceholder',
    },
    defaultCta: 'freeAnalysis.heroCta',
    optInKey: '',
    privacyKey: 'freeAnalysis.finalCtaNote',
  },
} as const;

export function InterestLeadForm({ variant, submitLabel, onSuccess }: InterestLeadFormProps) {
  const { t, i18n } = useTranslation();
  const config = VARIANT_CONFIG[variant];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [optIn, setOptIn] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Track form viewed on mount
  useEffect(() => {
    trackActivity({
      event_type: config.eventType,
      event_action: 'viewed',
    });
  }, [config.eventType]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');

    if (phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      setError(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
      return;
    }
    if (!isProfessionalEmail(email)) {
      setError(t('validation.professionalEmailOnly'));
      return;
    }

    setLoading(true);

    trackActivity({
      event_type: config.eventType,
      event_action: 'submitted',
    });

    try {
      const recaptcha_token = await executeRecaptcha('interest_lead');

      const body: Record<string, unknown> = {
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        page_url: window.location.href,
        recaptcha_token,
      };

      // Only include opt_in for variants that show the checkbox
      if (config.showOptIn) {
        body.opt_in = optIn;
      }

      const res = await fetch(`${EDGE_FUNCTION_BASE}/interest-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody?.error?.message || 'Request failed');
      }

      trackActivity({
        event_type: config.eventType,
        event_action: 'completed',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      trackActivity({
        event_type: config.eventType,
        event_action: 'errored',
        metadata: { error: msg },
      });
      setError(msg);
      setLoading(false);
    }
  }, [email, fullName, phone, website, optIn, t, onSuccess, config]);

  const getErrors = () => {
    const errors: string[] = [];
    if (error) errors.push(error);
    if ((submitAttempted || phoneTouched) && phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      errors.push(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
    }
    if ((submitAttempted || emailTouched) && email && !isProfessionalEmail(email)) {
      errors.push(t('validation.professionalEmailOnly'));
    }
    return [...new Set(errors)];
  };

  const allErrors = getErrors();
  const isEmailInvalid = (submitAttempted || emailTouched) && email && !isProfessionalEmail(email);
  const isPhoneInvalid = (submitAttempted || phoneTouched) && phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS;

  /* ── Reusable field renderers ── */

  const renderNameField = () => (
    <div className="auth-field" key="name">
      <label htmlFor={`${config.idPrefix}-name`}>
        {t(config.labels.name)} <span className="text-error">*</span>
      </label>
      <div className="auth-input-wrap">
        <User className="auth-input-icon" />
        <input
          id={`${config.idPrefix}-name`}
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t(config.placeholders.name)}
          required
          autoComplete="name"
        />
      </div>
    </div>
  );

  const renderEmailField = () => (
    <div className="auth-field" key="email">
      <label htmlFor={`${config.idPrefix}-email`}>
        {t(config.labels.email)} <span className="text-error">*</span>
      </label>
      <div className="auth-input-wrap">
        <Mail className="auth-input-icon" />
        <input
          id={`${config.idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailTouched(false);
          }}
          onBlur={() => setEmailTouched(true)}
          placeholder={t(config.placeholders.email)}
          required
          autoComplete="email"
          className={isEmailInvalid ? 'border-error' : ''}
        />
      </div>
    </div>
  );

  const renderPhoneField = () => (
    <div className="auth-field" key="phone">
      <label htmlFor={`${config.idPrefix}-phone`}>
        {t(config.labels.phone)} <span className="text-error">*</span>
      </label>
      <div className="auth-input-wrap">
        <PhoneInput
          id={`${config.idPrefix}-phone`}
          value={phone}
          onChange={(val) => {
            setPhone(val);
            setPhoneTouched(false);
          }}
          onBlur={() => setPhoneTouched(true)}
          defaultCountry={LANGUAGE_COUNTRY_MAP[i18n.language] || 'auto'}
          required
          placeholder={t(config.placeholders.phone)}
          className={isPhoneInvalid ? 'border-error' : ''}
        />
      </div>
    </div>
  );

  const renderWebsiteField = () => (
    <div className="auth-field" key="website">
      <label htmlFor={`${config.idPrefix}-website`}>
        {t(config.labels.website)} {config.websiteRequired && <span className="text-error">*</span>}
      </label>
      <div className="auth-input-wrap">
        <Globe className="auth-input-icon" />
        <input
          id={`${config.idPrefix}-website`}
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t(config.placeholders.website)}
          required={config.websiteRequired}
          autoComplete="url"
        />
      </div>
    </div>
  );

  const fieldRenderers: Record<string, () => React.JSX.Element> = {
    name: renderNameField,
    email: renderEmailField,
    phone: renderPhoneField,
    website: renderWebsiteField,
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {config.fieldOrder.map((field) => fieldRenderers[field]!())}

      {/* Opt-In (ebook variant only) */}
      {config.showOptIn && (
        <div className="auth-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1rem', cursor: 'pointer' }}>
          <input
            id={`${config.idPrefix}-optin`}
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            style={{ marginTop: '0.25rem' }}
          />
          <label htmlFor={`${config.idPrefix}-optin`} style={{ fontWeight: 'normal', cursor: 'pointer', lineHeight: '1.4' }}>
            {t(config.optInKey)}
          </label>
        </div>
      )}

      {allErrors.length > 0 && (
        <div className="auth-error mb-6 mt-4">
          {allErrors.map((err, idx) => (
            <div key={idx} dangerouslySetInnerHTML={{ __html: err }} />
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="auth-submit mt-4"
      >
        {loading ? (
          <span className="auth-spinner" />
        ) : (
          <>
            {submitLabel || t(config.defaultCta)}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="auth-footer-text mt-4 text-center" style={{ fontSize: '0.875rem' }}>
        {t(config.privacyKey)}
      </p>
    </form>
  );
}
