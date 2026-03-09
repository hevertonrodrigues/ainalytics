import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_NAME, LOCALES } from '@/lib/constants';
import { CheckCircle } from 'lucide-react';
import { SignUpForm } from '@/components/SignUpForm';

const LOCALE_LABELS: Record<string, string> = { en: 'EN', es: 'ES', 'pt-br': 'PT' };

export function SignUp() {
  const { t, i18n } = useTranslation();
  const [isSuccess, setIsSuccess] = useState(false);

  const changeLang = useCallback(
    (lng: string) => { i18n.changeLanguage(lng); },
    [i18n],
  );

  const handleSignUpSuccess = useCallback(() => {
    window.location.href = '/dashboard';
  }, []);

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
            <SignUpForm
              onSuccess={handleSignUpSuccess}
              onConfirmEmail={() => setIsSuccess(true)}
            />
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
