import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';

export function SignIn() {
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      // Hard redirect — guarantees AuthContext restores session from localStorage
      window.location.href = '/';
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="auth-bg" />

      <div className="w-full max-w-md stagger-enter">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-text-secondary mt-2 text-sm">{t('auth.signIn')}</p>
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
              <label htmlFor="signin-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="signin-email"
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
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="signin-password" className="text-sm font-medium text-text-secondary">
                  {t('auth.password')}
                </label>
                <Link to="/forgot-password" className="text-xs text-brand-secondary hover:text-brand-primary transition-colors">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? t('common.loading') : t('auth.signIn')}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="text-brand-secondary hover:text-brand-primary transition-colors font-medium">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
