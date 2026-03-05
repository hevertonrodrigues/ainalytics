import { useTranslation } from 'react-i18next';
import { ChevronRight, MessageSquare, List, BookOpen, FileText } from 'lucide-react';
import type { StepConfig } from './types';

interface WelcomeStepProps {
  stepConfig: StepConfig;
  direction: 'next' | 'prev';
  onNext: () => void;
}

const FEATURE_ICONS = [MessageSquare, List, BookOpen, FileText] as const;
const FEATURE_STYLES = [
  { color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
  { color: 'text-brand-accent', bg: 'bg-brand-accent/10' },
  { color: 'text-success', bg: 'bg-success/10' },
  { color: 'text-warning', bg: 'bg-warning/10' },
] as const;

export function WelcomeStep({
  stepConfig,
  direction,
  onNext,
}: WelcomeStepProps) {
  const { t } = useTranslation();
  const StepIcon = stepConfig.icon;

  return (
    <>
      {/* Main content */}
      <div
        key="welcome"
        className={`flex-1 flex flex-col transition-all duration-500 ease-out ${
          direction === 'next' ? 'animate-in slide-in-from-right-5' : 'animate-in slide-in-from-left-5'
        }`}
      >
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary border border-glass-border p-8 md:p-12 mb-8">
          {/* Decorative gradient blobs */}
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-accent))` }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-10"
            style={{ background: `linear-gradient(135deg, var(--brand-accent), var(--brand-primary))` }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-start gap-8">
            {/* Icon */}
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${stepConfig.color} flex items-center justify-center shrink-0 shadow-lg`}>
              <StepIcon className="w-10 h-10 text-white" />
            </div>

            {/* Text */}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3">
                {t('onboarding.steps.welcome.title')}
              </h1>
              <p className="text-base text-text-secondary leading-relaxed mb-4">
                {t('onboarding.steps.welcome.description')}
              </p>
              <p className="text-sm text-text-muted leading-relaxed">
                {t('onboarding.steps.welcome.detail')}
              </p>
            </div>
          </div>
        </div>

        {/* Feature cards — 2x2 grid matching the Welcome Modal's 4 features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[0, 1, 2, 3].map((featureIdx) => {
            const FIcon = FEATURE_ICONS[featureIdx]!;
            const style = FEATURE_STYLES[featureIdx]!;
            return (
              <div key={featureIdx} className="dashboard-card p-5 group hover:border-brand-primary/30 transition-colors">
                <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center mb-3 group-hover:opacity-90 transition-colors`}>
                  <FIcon className={`w-5 h-5 ${style.color}`} />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {t(`onboarding.steps.welcome.features.${featureIdx}.title`)}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t(`onboarding.steps.welcome.features.${featureIdx}.desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation — only Next since this is the first step */}
      <div className="flex items-center justify-between pt-6 border-t border-glass-border">
        <div />
        <button
          onClick={onNext}
          className="btn btn-primary btn-sm"
          id="onboarding-next-btn"
        >
          {t('onboarding.next')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
