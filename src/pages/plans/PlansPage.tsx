import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, CreditCard, Crown, Sparkles, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import type { Plan } from '@/types';

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Starter: Sparkles,
  Pro: Crown,
  Enterprise: Building2,
};

export function PlansPage() {
  const { t } = useTranslation();
  const { currentTenant } = useTenant();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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
    if (plan.price === 0 && (plan.settings as Record<string, unknown>)?.custom_pricing) {
      return t('plans.custom');
    }
    if (plan.price === 0) {
      return t('plans.free');
    }
    return `$${plan.price}`;
  };

  const getFeatures = (plan: Plan): string[] => {
    const settings = plan.settings as Record<string, unknown>;
    return (settings?.features as string[]) || [];
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

  return (
    <div className="stagger-enter max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-secondary text-xs font-medium mb-4">
          <CreditCard className="w-3.5 h-3.5" />
          {t('plans.badge')}
        </div>
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

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CreditCard className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted text-sm">{t('plans.noPlans')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const isPopular = plan.name === 'Pro';
            const PlanIcon = PLAN_ICONS[plan.name] || CreditCard;
            const features = getFeatures(plan);
            const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;

            return (
              <div
                key={plan.id}
                className={`
                  relative rounded-xl border transition-all duration-300 overflow-hidden
                  ${isPopular
                    ? 'bg-gradient-to-b from-brand-primary/10 to-bg-secondary border-brand-primary/40 shadow-lg shadow-brand-primary/10 scale-[1.02]'
                    : 'glass-card border-glass-border hover:border-brand-primary/20'
                  }
                  ${isCurrentPlan ? 'ring-2 ring-brand-primary/60' : ''}
                `}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-brand-primary to-brand-accent text-white text-xs font-semibold text-center py-1.5">
                    {t('plans.mostPopular')}
                  </div>
                )}

                <div className={`p-6 ${isPopular ? 'pt-10' : ''}`}>
                  {/* Plan icon & name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isPopular ? 'bg-brand-primary/20' : 'bg-glass-bg'
                    }`}>
                      <PlanIcon className={`w-5 h-5 ${isPopular ? 'text-brand-primary' : 'text-text-secondary'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-text-primary">{formatPrice(plan)}</span>
                      {plan.price > 0 && (
                        <span className="text-text-muted text-sm">{t('plans.perMonth')}</span>
                      )}
                    </div>
                  </div>

                  {/* Current plan badge */}
                  {isCurrentPlan && (
                    <div className="mb-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      {t('plans.currentPlan')}
                    </div>
                  )}

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isPopular ? 'text-brand-primary' : 'text-success'
                        }`} />
                        <span className="text-sm text-text-secondary">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Select button */}
                  {isCustom ? (
                    <button
                      className="w-full py-2.5 px-4 rounded-lg border border-glass-border text-text-secondary text-sm font-semibold hover:bg-glass-hover transition-colors"
                      disabled
                    >
                      {t('plans.contactSales')}
                    </button>
                  ) : isCurrentPlan ? (
                    <button
                      className="w-full py-2.5 px-4 rounded-lg bg-success/10 border border-success/20 text-success text-sm font-semibold cursor-default"
                      disabled
                    >
                      {t('plans.currentPlan')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={!!selecting}
                      className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        isPopular
                          ? 'bg-gradient-to-r from-brand-primary to-brand-accent text-white hover:opacity-90 shadow-md shadow-brand-primary/20'
                          : 'bg-glass-bg border border-glass-border text-text-primary hover:bg-glass-hover hover:border-brand-primary/30'
                      } ${selecting === plan.id ? 'opacity-60' : ''}`}
                    >
                      {selecting === plan.id ? t('common.loading') : t('plans.selectPlan')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Owner note */}
      <p className="text-center text-xs text-text-muted">
        {t('plans.ownerOnly')}
      </p>
    </div>
  );
}
