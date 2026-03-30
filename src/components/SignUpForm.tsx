import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthErrorMessage } from '@/lib/authErrors';
import { trackActivity } from '@/lib/analytics';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import type { Iso2 } from 'intl-tel-input/data';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Tag } from 'lucide-react';
import { isProfessionalEmail } from '@/lib/email';
import { executeRecaptcha } from '@/lib/recaptcha';

const LANGUAGE_COUNTRY_MAP: Record<string, Iso2> = {
  'pt-br': 'br',
  'es': 'es',
  'en': 'us',
};

export interface SignUpFormProps {
  /** Show the promo/offer code input field */
  showPromoCode?: boolean;
  /** Pre-fill the promo code (makes the field read-only) */
  defaultPromoCode?: string;
  /** Custom CTA button label (defaults to t('auth.createAccount')) */
  submitLabel?: string;
  /** Called after successful signup (instead of default redirect) */
  onSuccess?: () => void;
  /** Called when email confirmation is required */
  onConfirmEmail?: () => void;
}

export function SignUpForm({
  showPromoCode = false,
  defaultPromoCode = '',
  submitLabel,
  onSuccess,
  onConfirmEmail,
}: SignUpFormProps) {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState(defaultPromoCode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Track form viewed on mount
  useEffect(() => {
    trackActivity({
      event_type: 'signup_form',
      event_action: 'viewed',
      metadata: { has_promo: showPromoCode, has_default_code: !!defaultPromoCode },
    });
  }, [showPromoCode, defaultPromoCode]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');

    if (password.length < 8) {
      setError(t('validation.passwordMin', { min: 8 }));
      return;
    }
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
      event_type: 'signup_form',
      event_action: 'submitted',
      metadata: { has_promo: showPromoCode && !!promoCode },
    });

    try {
      const token = await executeRecaptcha('sign_up');
      if (token === null) {
        // Site key not set — skip gating in development
      }

      const codeValue = showPromoCode && promoCode ? promoCode : undefined;
      
      // Extract tracked UTM data
      const utmData: Record<string, string> = {};
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'landing_page', 'referrer'];
      for (const key of utmKeys) {
        const val = sessionStorage.getItem(key);
        if (val) utmData[key] = val;
      }
      
      await signUp(email, password, fullName, '', phone, '', codeValue, utmData);

      trackActivity({
        event_type: 'signup_form',
        event_action: 'completed',
        metadata: { confirm_email: false },
      });

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      const msg = getAuthErrorMessage(err, t);
      if (err instanceof Error && err.message === 'CONFIRM_EMAIL') {
        trackActivity({
          event_type: 'signup_form',
          event_action: 'confirm_email',
        });
        if (onConfirmEmail) {
          onConfirmEmail();
        }
      } else {
        trackActivity({
          event_type: 'signup_form',
          event_action: 'errored',
          metadata: { error: msg },
        });
        setError(msg);
      }
      setLoading(false);
    }
  }, [email, fullName, password, phone, promoCode, showPromoCode, signUp, t, onSuccess, onConfirmEmail]);

  const getErrors = () => {
    const errors: string[] = [];
    if (error) errors.push(error);
    if ((submitAttempted || passwordTouched) && password && password.length < 8) {
      errors.push(t('validation.passwordMin', { min: 8 }));
    }
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
  const isPasswordInvalid = (submitAttempted || passwordTouched) && password && password.length < 8;

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {/* Name */}
      <div className="auth-field">
        <label htmlFor="signup-name">
          {t('auth.fullName')} <span className="text-error">*</span>
        </label>
        <div className="auth-input-wrap">
          <User className="auth-input-icon" />
          <input
            id="signup-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('auth.placeholderName')}
            required
            autoComplete="name"
          />
        </div>
      </div>

      {/* Phone */}
      <div className="auth-field">
        <label htmlFor="signup-phone">
          {t('auth.phone')} <span className="text-error">*</span>
        </label>
        <div className="auth-input-wrap">
          <PhoneInput
            id="signup-phone"
            value={phone}
            onChange={(val) => {
              setPhone(val);
              setPhoneTouched(false);
            }}
            onBlur={() => setPhoneTouched(true)}
            defaultCountry={LANGUAGE_COUNTRY_MAP[i18n.language] || 'auto'}
            required
            placeholder={t('auth.placeholderPhone')}
            className={isPhoneInvalid ? 'border-error' : ''}
          />
        </div>
      </div>

      {/* Email */}
      <div className="auth-field">
        <label htmlFor="signup-email">
          {t('auth.email')} <span className="text-error">*</span>
        </label>
        <div className="auth-input-wrap">
          <Mail className="auth-input-icon" />
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTouched(false);
            }}
            onBlur={() => setEmailTouched(true)}
            placeholder={t('auth.placeholderEmail')}
            required
            autoComplete="email"
            className={isEmailInvalid ? 'border-error' : ''}
          />
        </div>
      </div>

      {/* Password */}
      <div className="auth-field">
        <label htmlFor="signup-password">
          {t('auth.password')} <span className="text-error">*</span>
        </label>
        <div className="auth-input-wrap">
          <Lock className="auth-input-icon" />
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.placeholderPassword')}
            required
            minLength={8}
            autoComplete="new-password"
            onBlur={() => setPasswordTouched(true)}
            className={isPasswordInvalid ? 'border-error' : ''}
          />
          <button
            type="button"
            className="auth-input-toggle"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Promo Code (optional) */}
      {showPromoCode && (
        <div className="auth-field">
          <label htmlFor="signup-code">
            {t('auth.promoCode')}
          </label>
          <div className="auth-input-wrap">
            <Tag className="auth-input-icon" />
            <input
              id="signup-code"
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder={t('auth.promoCodePlaceholder')}
              readOnly={!!defaultPromoCode}
              className={defaultPromoCode ? 'promo-code-locked' : ''}
            />
          </div>
        </div>
      )}

      {allErrors.length > 0 && (
        <div className="auth-error mb-6">
          {allErrors.map((err, idx) => (
            <div key={idx} dangerouslySetInnerHTML={{ __html: err }} />
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="auth-submit"
      >
        {loading ? (
          <span className="auth-spinner" />
        ) : (
          <>
            {submitLabel || t('auth.createAccount')}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
