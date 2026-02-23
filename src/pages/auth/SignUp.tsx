import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';

export function SignUp() {
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
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

    setLoading(true);
    try {
      await signUp(email, password, fullName, tenantName);
      // Hard redirect — guarantees AuthContext restores session from localStorage
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="auth-bg" />

      <div className="w-full max-w-md stagger-enter">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-text-secondary mt-2 text-sm">{t('auth.createAccount')}</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="signup-name" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.fullName')}
              </label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
                placeholder="John Doe"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="signup-org" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.orgName')}
              </label>
              <input
                id="signup-org"
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="input-field"
                placeholder="Acme Inc."
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? t('common.loading') : t('auth.createAccount')}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            {t('auth.hasAccount')}{' '}
            <Link to="/signin" className="text-brand-secondary hover:text-brand-primary transition-colors font-medium">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
