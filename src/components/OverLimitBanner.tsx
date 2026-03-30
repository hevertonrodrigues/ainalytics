import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OverLimitBannerProps {
  type: 'prompts' | 'models';
  current: number;
  max: number;
}

export function OverLimitBanner({ type, current, max }: OverLimitBannerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="p-4 rounded-xs border border-warning/30 bg-warning/5 backdrop-blur-sm animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-full bg-warning/10 shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-warning mb-1">
            {t('limits.overLimitTitle')}
          </h4>
          <p className="text-sm text-text-secondary leading-relaxed">
            {type === 'prompts'
              ? t('limits.overLimitPrompts', { current, max })
              : t('limits.overLimitModels', { current, max })}
          </p>
          <p className="text-xs text-text-muted mt-1.5">
            {t('limits.deleteToFix')}
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/plans')}
          className="btn btn-sm bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 transition-all gap-1.5 shrink-0"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
          {t('limits.upgradePlan')}
        </button>
      </div>
    </div>
  );
}
