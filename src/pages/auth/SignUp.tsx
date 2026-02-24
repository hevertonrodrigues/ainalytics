import { useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { PhoneInput, getPhoneDigitCount, MIN_PHONE_DIGITS } from '@/components/PhoneInput';
import { Mail, Lock, User, Building2, Phone, ArrowRight, Eye, EyeOff } from 'lucide-react';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('validation.passwordMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('validation.passwordMin', { min: 8 }));
      return;
    }
    if (getPhoneDigitCount(phone) < MIN_PHONE_DIGITS) {
      setError(t('validation.phoneMin', { min: MIN_PHONE_DIGITS }));
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName, tenantName, phone);
      // Hard redirect — guarantees AuthContext restores session from localStorage
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
      setLoading(false);
    }
  };

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
              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
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
                    <Phone className="auth-input-icon" />
                    <PhoneInput
                      id="signup-phone"
                      value={phone}
                      onChange={setPhone}
                      required
                    />
                  </div>
                  {phone && getPhoneDigitCount(phone) < MIN_PHONE_DIGITS && (
                    <span className="auth-field-hint text-error">
                      {t('validation.phoneMin', { min: MIN_PHONE_DIGITS })}
                    </span>
                  )}
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
                    />
                  </div>
                </div>
              </div>

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
