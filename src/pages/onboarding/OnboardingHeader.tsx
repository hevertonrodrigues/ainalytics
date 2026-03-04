import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { LOCALES } from '@/lib/constants';
import { LOCALE_LABELS } from './types';

interface OnboardingHeaderProps {
  step: number;
  totalSteps: number;
  onSkip: () => void;
}

export function OnboardingHeader({ step, totalSteps, onSkip }: OnboardingHeaderProps) {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-500"
            style={{
              background: i <= step
                ? 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))'
                : 'var(--glass-border)',
            }}
          />
        ))}
      </div>

      {/* Step indicator + controls */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {t('onboarding.stepOf', { current: step + 1, total: totalSteps })}
        </span>
        <div className="flex items-center gap-3">
          <div className="locale-switcher" style={{ marginRight: 0 }}>
            {Object.values(LOCALES).map((lng) => (
              <button
                key={lng}
                className={`locale-btn${i18n.language === lng ? ' active' : ''}`}
                onClick={() => i18n.changeLanguage(lng)}
              >
                {LOCALE_LABELS[lng]}
              </button>
            ))}
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-glass-hover transition-colors text-text-muted hover:text-text-primary"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onSkip}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            id="onboarding-skip-btn"
          >
            {t('onboarding.skip')}
          </button>
        </div>
      </div>
    </>
  );
}
