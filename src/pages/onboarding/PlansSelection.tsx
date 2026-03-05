import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, KeyRound, Loader2, Ticket } from 'lucide-react';
import { PricingPlans } from '@/components/PricingPlans';
import type { PricingPlan, BillingPeriod } from '@/components/PricingPlans';
import { InterestFormModal } from '@/components/InterestFormModal';

interface ActivationCodeModalProps {
  onClose: () => void;
  onActivate: () => void;
  activationCode: string;
  setActivationCode: (val: string) => void;
  codeError: string;
  selecting: string | null;
}

function ActivationCodeModal({
  onClose,
  onActivate,
  activationCode,
  setActivationCode,
  codeError,
  selecting,
}: ActivationCodeModalProps) {
  const { t } = useTranslation();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => codeInputRef.current?.focus(), 100);
  }, []);

  return createPortal(
    <div className="interest-modal-overlay" onClick={onClose}>
      <div className="interest-modal" onClick={(e) => e.stopPropagation()}>
        <div className="interest-modal-header">
          <div>
            <h3 className="interest-modal-title">{t('plans.activationTitle')}</h3>
            <p className="interest-modal-subtitle">{t('plans.activationDesc')}</p>
          </div>
          <button className="interest-modal-close" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="interest-modal-form">
          <div className="interest-field">
            <label>{t('plans.activationTitle')}</label>
            <input
              ref={codeInputRef}
              type="text"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onActivate()}
              placeholder={t('plans.activationPlaceholder')}
            />
          </div>
          {codeError && <p className="interest-modal-error">{codeError}</p>}
          <button
            onClick={onActivate}
            disabled={!activationCode.trim() || !!selecting}
            className="btn btn-primary w-full"
            style={selecting ? { opacity: 0.6 } : undefined}
          >
            <KeyRound className="w-4 h-4" />
            {selecting ? '...' : t('plans.activate')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface PlansSelectionProps {
  pricingPlans: PricingPlan[];
  numericPrices?: number[];
  formatPrice?: (price: number) => string;
  plansLoading: boolean;
  codeModalPlanId: string | null;
  activationCode: string;
  codeError: string;
  selecting: string | null;
  interestModalOpen: boolean;
  onCloseCodeModal: () => void;
  onActivate: () => void;
  onSetActivationCode: (val: string) => void;
  onCloseInterestModal: () => void;
  onOpenCodeModal: () => void;
  onBillingPeriodChange?: (period: BillingPeriod) => void;
}

export function PlansSelection({
  pricingPlans,
  numericPrices,
  formatPrice,
  plansLoading,
  codeModalPlanId,
  activationCode,
  codeError,
  selecting,
  interestModalOpen,
  onCloseCodeModal,
  onActivate,
  onSetActivationCode,
  onCloseInterestModal,
  onOpenCodeModal,
  onBillingPeriodChange,
}: PlansSelectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mt-3 pt-3 border-t border-glass-border">
        <h3 className="text-lg font-bold text-text-primary text-center mb-4">{t('plans.title')}</h3>
        {plansLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : (
          <PricingPlans
            plans={pricingPlans}
            numericPrices={numericPrices}
            formatPrice={formatPrice}
            onBillingPeriodChange={onBillingPeriodChange}
          />
        )}

        {/* "Já tenho uma assinatura" Button */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={onOpenCodeModal}
            className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-primary/80 transition-colors font-medium"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem' }}
          >
            <Ticket className="w-4 h-4" />
            {t('plans.hasSubscription')}
          </button>
        </div>
      </div>

      {codeModalPlanId && (
        <ActivationCodeModal
          onClose={onCloseCodeModal}
          onActivate={onActivate}
          activationCode={activationCode}
          setActivationCode={onSetActivationCode}
          codeError={codeError}
          selecting={selecting}
        />
      )}

      <InterestFormModal open={interestModalOpen} onClose={onCloseInterestModal} />
    </>
  );
}
