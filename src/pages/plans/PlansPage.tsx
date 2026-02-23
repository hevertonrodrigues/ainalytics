import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { PricingPlans } from '@/components/PricingPlans';
import type { PricingPlan } from '@/components/PricingPlans';
import { InterestFormModal } from '@/components/InterestFormModal';
import type { Plan } from '@/types';

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const { currentTenant } = useTenant();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [interestModalOpen, setInterestModalOpen] = useState(false);

  useEffect(() => {
    if (currentTenant) loadPlans();
  }, [currentTenant?.id]);

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

  const handleSelectPlan = async (planId: string) => {
    if (selecting || planId === currentPlanId) return;
    setError('');
    setSelecting(planId);

    try {
      await apiClient.put('/plans', { plan_id: planId });
      setCurrentPlanId(planId);
      setSuccess(t('plans.planSelected'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      setError(msg);
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
          : () => handleSelectPlan(plan.id),
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
    </div>
  );
}
