import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { CATEGORY_COLORS } from './types';

interface CategoryInfoModalProps {
  onClose: () => void;
}

const CATEGORIES = ['technical', 'content', 'authority', 'semantic'] as const;

export function CategoryInfoModal({ onClose }: CategoryInfoModalProps) {
  const { t } = useTranslation();

  return (
    <div className="interest-modal-overlay" onClick={onClose}>
      <div
        className="interest-modal"
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="interest-modal-header">
          <div>
            <h2 className="interest-modal-title">{t('onboarding.analyze.categoriesInfoTitle')}</h2>
            <p className="interest-modal-subtitle">{t('onboarding.analyze.categoriesInfoSubtitle')}</p>
          </div>
          <button className="interest-modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="space-y-5">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="flex gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] || '#6c5ce7' }}
                />
                <div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">
                    {t(`onboarding.analyze.categories.${cat}`)}
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {t(`onboarding.analyze.categoryExplain.${cat}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/10">
            <p className="text-xs text-text-muted leading-relaxed italic">
              {t('onboarding.analyze.categoryExplain.summary')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
