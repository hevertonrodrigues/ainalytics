import { useState, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

export function SignIn() {
  const { t, i18n } = useTranslation();
  const { signIn } = useAuth();

  const changeLang = useCallback(
    (lng: string) => { i18n.changeLanguage(lng); },
    [i18n],
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
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
          <h2 className="auth-decor-title">{t('auth.welcomeBack')}</h2>
          <p className="auth-decor-text">{t('auth.signInDecor')}</p>
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
          <h1 className="auth-heading">{t('auth.signIn')}</h1>
          <p className="auth-subheading">{t('auth.signInSubtitle')}</p>

          {/* Card */}
          <div className="auth-card">
            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="auth-field">
                <label htmlFor="signin-email">{t('auth.email')}</label>
                <div className="auth-input-wrap">
                  <Mail className="auth-input-icon" />
                  <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <div className="auth-field-header">
                  <label htmlFor="signin-password">{t('auth.password')}</label>
                  <Link to="/forgot-password" className="auth-forgot" tabIndex={-1}>
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              <button
                type="submit"
                disabled={loading}
                className="auth-submit"
              >
                {loading ? (
                  <span className="auth-spinner" />
                ) : (
                  <>
                    {t('auth.signIn')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="auth-footer-text">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="auth-footer-link">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
