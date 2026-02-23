import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { SearchSelect } from '@/components/ui/SearchSelect';
import type { Profile, UpdateProfileInput } from '@/types';

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt-br', label: 'Português (BR)' },
];

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile: authProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [locale, setLocale] = useState<'en' | 'es' | 'pt-br'>('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiClient.get<{ profile: Profile }>('/users-me');
      const { profile: p } = res.data;
      setFullName(p?.full_name || '');
      setPhone(p?.phone || '');
      setLocale((p?.locale as 'en' | 'es' | 'pt-br') || 'en');
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const input: UpdateProfileInput = { full_name: fullName, phone, locale };
      await apiClient.put('/users-me', input);
      setSuccess(t('profile.saved'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="glass-card p-8 space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-10 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{t('profile.title')}</h1>

      <div className="glass-card p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              {success}
            </div>
          )}

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={authProfile?.email || ''}
              disabled
              className="input-field opacity-60"
            />
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('profile.fullName')}
            </label>
            <input
              id="profile-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="profile-phone" className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('profile.phone')}
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Locale */}
          <div>
            <label htmlFor="profile-locale" className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('profile.locale')}
            </label>
            <SearchSelect
              id="profile-locale"
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={(val) => setLocale(val as 'en' | 'es' | 'pt-br')}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
