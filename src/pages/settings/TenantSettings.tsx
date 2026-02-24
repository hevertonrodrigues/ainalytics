import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export function TenantSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();

  if (!currentTenant) return null;

  return (
    <div className="stagger-enter max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-text-primary">{t('settings.title')}</h1>

      <div className="dashboard-card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{t('settings.organization')}</h2>
            <p className="text-xs text-text-muted">{t('settings.orgDesc')}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('settings.orgName')}
          </label>
          <div className="input-field bg-bg-tertiary/50 cursor-default opacity-80">
            {currentTenant.name}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t('settings.orgSlug')}
          </label>
          <div className="input-field bg-bg-tertiary/50 cursor-default opacity-80 font-mono text-sm">
            {currentTenant.slug}
          </div>
        </div>
      </div>
    </div>
  );
}
