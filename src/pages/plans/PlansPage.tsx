import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, KeyRound, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { PricingPlans } from '@/components/PricingPlans';
import type { PricingPlan } from '@/components/PricingPlans';
import { InterestFormModal } from '@/components/InterestFormModal';
import type { Plan } from '@/types';

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const { currentTenant, updateTenantPlanId } = useTenant();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [interestModalOpen, setInterestModalOpen] = useState(false);

  // Activation code modal
  const [codeModalPlanId, setCodeModalPlanId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentTenant) loadPlans();
  }, [currentTenant?.id]);

  // Focus the code input when modal opens
  useEffect(() => {
    if (codeModalPlanId) {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [codeModalPlanId]);

  const loadPlans = async () => {
    try {
      const res = await apiClient.get<{ plans: Plan[]; current_plan_id: string | null }>('/plans');
      setPlans(res.data.plans || []);
      setCurrentPlanId(res.data.current_plan_id);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const openCodeModal = (planId: string) => {
    setCodeModalPlanId(planId);
    setActivationCode('');
    setCodeError('');
  };

  const closeCodeModal = () => {
    setCodeModalPlanId(null);
    setActivationCode('');
    setCodeError('');
  };

  const handleActivate = async () => {
    if (!codeModalPlanId || !activationCode.trim()) return;
    setCodeError('');
    setSelecting(codeModalPlanId);

    try {
      await apiClient.put('/plans', {
        plan_id: codeModalPlanId,
        activation_code: activationCode.trim(),
      });
      setCurrentPlanId(codeModalPlanId);
      updateTenantPlanId(codeModalPlanId);
      closeCodeModal();
      setSuccess(t('plans.planSelected'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setCodeError(msg);
    } finally {
      setSelecting(null);
    }
  };

  const formatPrice = (plan: Plan) => {
    if ((plan.settings as Record<string, unknown>)?.custom_pricing) {
      return t('plans.custom');
    }
    return `$${plan.price}`;
  };

  const getFeatures = (plan: Plan): string[] => {
    const lang = i18n.language || 'en';
    return plan.features?.[lang] || plan.features?.['en'] || [];
  };

  const getDescription = (plan: Plan): string => {
    const settings = plan.settings as Record<string, unknown>;
    return (settings?.description as string) || '';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-96 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  /* Map API plans → PricingPlan props */
  const pricingPlans: PricingPlan[] = plans.map((plan, idx) => {
    const isCurrentPlan = plan.id === currentPlanId;
    const isPopular = plan.name === 'Growth';
    const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;

    return {
      name: plan.name,
      price: formatPrice(plan),
      priceLabel: plan.price > 0 ? t('plans.perMonth') : undefined,
      description: getDescription(plan),
      features: getFeatures(plan),
      popular: isPopular ? t('plans.mostPopular') : undefined,
      isBlock: idx >= 3,
      cta: isCustom ? t('plans.contactSales') : t('plans.selectPlan'),
      onSelect: isCustom
        ? () => setInterestModalOpen(true)
        : isCurrentPlan
          ? undefined
          : () => openCodeModal(plan.id),
      disabled: !!selecting,
      loading: selecting === plan.id,
      statusLabel: isCurrentPlan ? t('plans.currentPlan') : undefined,
    };
  });

  return (
    <div className="stagger-enter max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t('plans.title')}</h1>
        <p className="text-text-secondary mt-2 text-sm max-w-lg mx-auto">{t('plans.subtitle')}</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm text-center">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm text-center">
          {success}
        </div>
      )}

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CreditCard className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('plans.noPlans')}</p>
        </div>
      ) : (
        <PricingPlans plans={pricingPlans} />
      )}

      {/* Owner note */}
      <p className="text-center text-xs text-text-muted">
        {t('plans.ownerOnly')}
      </p>

      {/* Interest Form Modal */}
      <InterestFormModal
        open={interestModalOpen}
        onClose={() => setInterestModalOpen(false)}
      />

      {/* Activation Code Modal */}
      {codeModalPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeCodeModal} />

          {/* Modal */}
          <div className="relative w-full max-w-sm dashboard-card p-6 space-y-4 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-brand-primary" />
                </div>
                <h2 className="text-sm font-semibold text-text-primary">{t('plans.activationTitle')}</h2>
              </div>
              <button onClick={closeCodeModal} type="button" className="icon-btn">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted">{t('plans.activationDesc')}</p>

            {/* Error */}
            {codeError && (
              <div className="p-2 rounded-xs bg-error/10 border border-error/20 text-error text-xs">
                {codeError}
              </div>
            )}

            {/* Code input */}
            <form onSubmit={(e) => { e.preventDefault(); handleActivate(); }}>
              <input
                ref={codeInputRef}
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder={t('plans.activationPlaceholder')}
                maxLength={12}
                className="input-field text-center font-mono tracking-widest text-lg uppercase"
                autoFocus
              />

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="submit"
                  disabled={!!selecting || activationCode.trim().length !== 12}
                  className="btn btn-primary btn-sm flex-1"
                >
                  {selecting ? t('common.loading') : t('plans.activate')}
                </button>
                <button onClick={closeCodeModal} type="button" className="btn btn-ghost btn-sm">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
