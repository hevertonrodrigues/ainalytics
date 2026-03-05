import { useTranslation } from 'react-i18next';
import {
  Globe,
  Bot,
  Search,
  ChevronLeft,
  Loader2,
  Radar,
  Shield,
  FileText,
  Building2,
} from 'lucide-react';

interface AnalyzeFormProps {
  domain: string;
  companyName: string;
  analyzing: boolean;
  error: string;
  onDomainChange: (value: string) => void;
  onCompanyNameChange: (value: string) => void;
  onAnalyze: () => void;
  onBack: () => void;
}

export function AnalyzeForm({
  domain,
  companyName,
  analyzing,
  error,
  onDomainChange,
  onCompanyNameChange,
  onAnalyze,
  onBack,
}: AnalyzeFormProps) {
  const { t } = useTranslation();

  return (
    <div key="input" className="flex-1 flex flex-col">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-12 mb-8">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-accent/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shrink-0 shadow-lg shadow-brand-primary/20">
              <Radar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                {t('onboarding.analyze.title')}
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                {t('onboarding.analyze.subtitle')}
              </p>
            </div>
          </div>

          <p className="text-sm text-text-muted leading-relaxed mt-4">
            {t('onboarding.analyze.description')}
          </p>
        </div>
      </div>

      {/* Input card */}
      <div className="dashboard-card p-8 mb-8">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label block mb-1.5">{t('company.domain')} *</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => onDomainChange(e.target.value)}
                  placeholder={t('company.domainPlaceholder')}
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAnalyze(); }}
                  disabled={analyzing}
                  id="onboarding-domain-input"
                />
              </div>
            </div>
            <div>
              <label className="kpi-label block mb-1.5">{t('auth.orgName')}</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => onCompanyNameChange(e.target.value)}
                  placeholder="Acme Inc."
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                  disabled={analyzing}
                  id="onboarding-company-name-input"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {error}
            </div>
          )}

          <button
            onClick={onAnalyze}
            disabled={analyzing || !domain.trim()}
            className="btn btn-primary w-full py-3 text-base font-semibold"
            id="onboarding-analyze-btn"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('onboarding.analyze.analyzing')}
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                {t('onboarding.analyze.cta')}
              </>
            )}
          </button>

          {analyzing && (
            <p className="text-xs text-text-muted text-center animate-pulse">
              {t('onboarding.analyze.wait')}
            </p>
          )}
        </div>
      </div>

      {/* What we check */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: FileText, label: t('onboarding.analyze.checks.robots') },
          { icon: Globe, label: t('onboarding.analyze.checks.sitemap') },
          { icon: Bot, label: t('onboarding.analyze.checks.llms') },
          { icon: Shield, label: t('onboarding.analyze.checks.homepage') },
        ].map(({ icon: CheckIcon, label }) => (
          <div key={label} className="dashboard-card p-3 flex items-center gap-2 text-xs text-text-secondary">
            <CheckIcon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
            {label}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="mt-auto pt-6 border-t border-glass-border flex">
        <button onClick={onBack} className="btn btn-ghost btn-sm" id="onboarding-prev-analyze">
          <ChevronLeft className="w-4 h-4" />
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
