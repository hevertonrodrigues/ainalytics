import { useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import type { Iso2 } from 'intl-tel-input/data';
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { extractRootDomain } from '@/lib/domain';
import { isProfessionalEmail, extractDomainFromEmail, suggestCompanyNameFromDomain } from '@/lib/email';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };
const LANGUAGE_COUNTRY_MAP: Record<string, Iso2> = {
  'pt-br': 'br',
  'es': 'es',
  'en': 'us'
};

export function SignUp() {
  const { t, i18n } = useTranslation();
  const { signUp } = useAuth();

  const changeLang = useCallback(
    (lng: string) => { i18n.changeLanguage(lng); },
    [i18n],
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [mainDomain, setMainDomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  const handleEmailSync = useCallback((emailValue: string) => {
    const domain = extractDomainFromEmail(emailValue);
    if (domain && isProfessionalEmail(emailValue)) {
      const rootDomain = extractRootDomain(domain) || domain;
      setMainDomain(rootDomain);
      setTenantName(suggestCompanyNameFromDomain(rootDomain));
    } else if (!emailValue) {
      setMainDomain('');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('validation.passwordMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('validation.passwordMin', { min: 8 }));
      return;
    }
    if (phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      setError(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
      return;
    }

    // Professional Email Validation
    if (!isProfessionalEmail(email)) {
      setError(t('validation.professionalEmailOnly'));
      return;
    }

    // TLD and Subdomain Validation/Extraction
    const cleanedDomain = extractRootDomain(mainDomain);
    if (!cleanedDomain) {
      setError(t('validation.invalidDomain', 'Please enter a valid main domain URL'));
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName, tenantName, phone, cleanedDomain);
      // Hard redirect — guarantees AuthContext restores session from localStorage
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      if (msg === 'CONFIRM_EMAIL') {
        setIsSuccess(true);
      } else {
        // Handle specific Supabase auth errors if possible, or just set generic error
        setError(msg);
      }
      setLoading(false);
    }
  };

  const getErrors = () => {
    const errors: string[] = [];
    
    // Form-level error (from submission)
    if (error) errors.push(error);

    // Dynamic validation errors
    if ((submitAttempted || (password && confirmPassword)) && password !== confirmPassword) {
      errors.push(t('validation.passwordMatch'));
    }
    if ((submitAttempted || passwordTouched) && password && password.length < 8) {
      errors.push(t('validation.passwordMin', { min: 8 }));
    }
    if ((submitAttempted || phoneTouched) && phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      errors.push(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
    }
    if ((submitAttempted || emailTouched) && email && !isProfessionalEmail(email)) {
      errors.push(t('validation.professionalEmailOnly'));
    }
    if (submitAttempted && !extractRootDomain(mainDomain)) {
      errors.push(t('validation.invalidDomain'));
    }

    return [...new Set(errors)]; // Deduplicate
  };

  const allErrors = getErrors();
  const isEmailInvalid = (submitAttempted || emailTouched) && email && !isProfessionalEmail(email);
  const isPhoneInvalid = (submitAttempted || phoneTouched) && phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS;
  const isPasswordInvalid = (submitAttempted || passwordTouched) && password && password.length < 8;
  const isConfirmInvalid = (submitAttempted || (password && confirmPassword)) && password !== confirmPassword;
  const isDomainInvalid = submitAttempted && !extractRootDomain(mainDomain);

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-bg" />

        {/* Decorative side */}
        <div className="auth-decor">
          <div className="auth-decor-content">
            <h2 className="auth-decor-title">{t('auth.startJourney')}</h2>
            <p className="auth-decor-text">{t('auth.signUpDecor')}</p>
            <div className="auth-decor-features">
              <div className="auth-decor-feature">
                <span className="auth-decor-dot" />
                {t('auth.decorFeature1')}
              </div>
              <div className="auth-decor-feature">
                <span className="auth-decor-dot" />
                {t('auth.decorFeature2')}
              </div>
              <div className="auth-decor-feature">
                <span className="auth-decor-dot" />
                {t('auth.decorFeature3')}
              </div>
            </div>
          </div>
        </div>

        {/* Form side */}
        <div className="auth-form-side">
          <div className="auth-form-container stagger-enter">
            <div className="auth-top-bar">
              <Link to="/" className="auth-logo">
                <img src="/logo-purple.png" alt="Ainalytics" className="auth-logo-img" />
                {APP_NAME}
              </Link>
              <div className="locale-switcher">
                {Object.values(LOCALES).map((lng) => (
                  <button
                    key={lng}
                    className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                    onClick={() => changeLang(lng)}
                  >
                    {LOCALE_LABELS[lng]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="auth-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-4">{t('auth.checkEmailTitle', 'Check your email')}</h1>
              <p className="text-text-secondary mb-8">
                {t('auth.checkEmailDesc', 'We just sent a confirmation link. Please check your inbox (and spam folder) to verify your account before signing in.')}
              </p>
              <Link to="/signin" className="btn btn-primary w-full">
                {t('auth.goToSignIn', 'Go to Sign In')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />

      {/* Decorative side */}
      <div className="auth-decor">
        <div className="auth-decor-content">
          <h2 className="auth-decor-title">{t('auth.startJourney')}</h2>
          <p className="auth-decor-text">{t('auth.signUpDecor')}</p>
          <div className="auth-decor-features">
            <div className="auth-decor-feature">
              <span className="auth-decor-dot" />
              {t('auth.decorFeature1')}
            </div>
            <div className="auth-decor-feature">
              <span className="auth-decor-dot" />
              {t('auth.decorFeature2')}
            </div>
            <div className="auth-decor-feature">
              <span className="auth-decor-dot" />
              {t('auth.decorFeature3')}
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="auth-form-side">
        <div className="auth-form-container stagger-enter">
          <div className="auth-top-bar">
            <Link to="/" className="auth-logo">
              <img src="/logo-purple.png" alt="Ainalytics" className="auth-logo-img" />
              {APP_NAME}
            </Link>
            <div className="locale-switcher">
              {Object.values(LOCALES).map((lng) => (
                <button
                  key={lng}
                  className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                  onClick={() => changeLang(lng)}
                >
                  {LOCALE_LABELS[lng]}
                </button>
              ))}
            </div>
          </div>
          <h1 className="auth-heading">{t('auth.createAccount')}</h1>
          <p className="auth-subheading">{t('auth.signUpSubtitle')}</p>

          {/* Card */}
          <div className="auth-card">
            <form onSubmit={handleSubmit} className="auth-form">

              {/* Two-column: Name + Email */}
              <div className="auth-row">
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
                      placeholder="John Doe"
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>

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
                        const newEmail = e.target.value;
                        setEmail(newEmail);
                        setEmailTouched(false);
                        handleEmailSync(newEmail);
                      }}
                      onBlur={() => {
                        setEmailTouched(true);
                        handleEmailSync(email);
                      }}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      className={isEmailInvalid ? 'border-error' : ''}
                    />
                  </div>
                </div>
              </div>

              {/* Two-column: Phone + Org */}
              <div className="auth-row">
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
                      className={isPhoneInvalid ? 'border-error' : ''}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-org">
                    {t('auth.orgName')} <span className="text-error">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Building2 className="auth-input-icon" />
                    <input
                      id="signup-org"
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Acme Inc."
                      required
                    />
                  </div>
                </div>
              </div>

              {/* One-column: Main Domain */}
              <div className="auth-row">
                <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="signup-domain">
                    {t('auth.mainDomain', 'Main Domain (Website URLs allowed)')} <span className="text-error">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Building2 className="auth-input-icon" />
                    <input
                      id="signup-domain"
                      type="text"
                      value={mainDomain}
                      onChange={(e) => setMainDomain(e.target.value)}
                      placeholder="example.com"
                      required
                      readOnly
                      className={`bg-muted/50 cursor-not-allowed ${isDomainInvalid ? 'border-error' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* Two-column: Password + Confirm */}
              <div className="auth-row">
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
                      placeholder="••••••••"
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

                <div className="auth-field">
                  <label htmlFor="signup-confirm">
                    {t('auth.confirmPassword')} <span className="text-error">*</span>
                  </label>
                  <div className="auth-input-wrap">
                    <Lock className="auth-input-icon" />
                    <input
                      id="signup-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className={isConfirmInvalid ? 'border-error' : ''}
                    />
                  </div>
                </div>
              </div>
              
              {allErrors.length > 0 && (
                <div className="auth-error mb-6">
                  {allErrors.map((err, idx) => (
                    <div key={idx}>{err}</div>
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
                    {t('auth.createAccount')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="auth-footer-text">
            {t('auth.hasAccount')}{' '}
            <Link to="/signin" className="auth-footer-link">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
