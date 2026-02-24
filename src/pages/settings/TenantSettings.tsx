import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Save, Globe, Repeat } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { extractRootDomain } from '@/lib/domain';

export function TenantSettings() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();
  const { showToast } = useToast();

  const [mainDomain, setMainDomain] = useState(currentTenant?.main_domain || '');
  const [executionsPerHour, setExecutionsPerHour] = useState(currentTenant?.prompt_executions_per_hour ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExec, setIsSavingExec] = useState(false);

  if (!currentTenant) return null;

  const handleSaveDomain = async (e: FormEvent) => {
    e.preventDefault();
    
    // TLD and Subdomain Validation/Extraction
    const cleanedDomain = extractRootDomain(mainDomain);
    if (!cleanedDomain) {
      showToast(t('validation.invalidDomain', 'Please enter a valid main domain URL'), 'error');
      return;
    }
    
    // Opt-in UI update so they see the cleaned version
    setMainDomain(cleanedDomain);

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_tenant_domain', {
        p_tenant_id: currentTenant.id,
        p_main_domain: cleanedDomain,
      });

      if (error) throw error;
      
      showToast(t('settings.saved', 'Settings saved successfully'), 'success');
    } catch (err: any) {
      showToast(err.message || t('common.error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveExecutions = async (e: FormEvent) => {
    e.preventDefault();
    const val = Math.max(1, Math.min(10, executionsPerHour));
    setExecutionsPerHour(val);
    setIsSavingExec(true);
    try {
      const { error } = await supabase.rpc('update_tenant_prompt_executions', {
        p_tenant_id: currentTenant.id,
        p_executions: val,
      });
      if (error) throw error;
      showToast(t('settings.saved', 'Settings saved successfully'), 'success');
    } catch (err: any) {
      showToast(err.message || t('common.error'), 'error');
    } finally {
      setIsSavingExec(false);
    }
  };

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
        
        <form onSubmit={handleSaveDomain} className="pt-4 border-t border-border-color space-y-4">
          <div>
            <label htmlFor="mainDomain" className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('settings.mainDomain', 'Main Domain')}
            </label>
            <div className="auth-input-wrap relative flex items-center">
              <Globe className="absolute left-3 w-5 h-5 text-text-muted" />
              <input
                id="mainDomain"
                type="text"
                value={mainDomain}
                onChange={(e) => setMainDomain(e.target.value)}
                placeholder="example.com"
                required
                className="input-field w-full pl-10"
              />
            </div>
            <p className="text-xs text-text-muted mt-2">
              {t('settings.mainDomainHint', 'The core website URL to associate with your tenant account.')}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary min-w-[120px]"
            >
              {isSaving ? (
                <span className="auth-spinner mx-auto" style={{ width: 16, height: 16 }} />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('common.save', 'Save Changes')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Background Search Configuration */}
      <div className="dashboard-card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
            <Repeat className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {t('settings.backgroundSearch', 'Background Search')}
            </h2>
            <p className="text-xs text-text-muted">
              {t('settings.backgroundSearchDesc', 'Configure how often prompts are executed automatically against your active models.')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveExecutions} className="space-y-4">
          <div>
            <label htmlFor="executionsPerHour" className="block text-sm font-medium text-text-secondary mb-1.5">
              {t('settings.executionsPerHour', 'Executions per Hour')}
            </label>
            <input
              id="executionsPerHour"
              type="number"
              min={1}
              max={10}
              value={executionsPerHour}
              onChange={(e) => setExecutionsPerHour(Number(e.target.value))}
              className="input-field w-full max-w-[200px]"
            />
            <p className="text-xs text-text-muted mt-2">
              {t('settings.executionsPerHourHint', 'How many times each prompt is sent to each active model per hourly cycle (1-10). Higher values give more data points but increase API costs.')}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingExec}
              className="btn btn-primary min-w-[120px]"
            >
              {isSavingExec ? (
                <span className="auth-spinner mx-auto" style={{ width: 16, height: 16 }} />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t('common.save', 'Save Changes')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
