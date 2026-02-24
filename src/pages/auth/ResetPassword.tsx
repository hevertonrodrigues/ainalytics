import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { APP_NAME } from '@/lib/constants';

export function ResetPassword() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      await resetPassword(password);
      navigate('/signin', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="auth-bg" />

      <div className="w-full max-w-md stagger-enter">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
            {APP_NAME}
          </h1>
          <p className="text-text-secondary mt-2 text-sm">{t('auth.resetPassword')}</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.newPassword')}
              </label>
              <input
                id="reset-password"
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
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="reset-confirm"
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
              {loading ? t('common.loading') : t('auth.resetPassword')}
            </button>
          </form>

          <p className="text-center text-sm text-text-muted mt-6">
            <Link to="/signin" className="text-brand-secondary hover:text-brand-primary transition-colors font-medium">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
