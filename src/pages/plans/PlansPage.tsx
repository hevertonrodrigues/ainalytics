import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, Ticket, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { PricingPlans } from '@/components/PricingPlans';
import { useCurrency } from '@/hooks/useCurrency';
import type { PricingPlan, BillingPeriod } from '@/components/PricingPlans';
import { InterestFormModal } from '@/components/InterestFormModal';
import type { Plan } from '@/types';
import { ActivationCodeModal } from './ActivationCodeModal';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { SubscriptionSettings } from './SubscriptionSettings';

// ─── Helpers ────────────────────────────────────────────────

const ACTIVATION_ERROR_MAP: Record<string, string> = {
  'Invalid activation code': 'plans.errors.invalidCode',
  'This activation code is no longer active': 'plans.errors.codeInactive',
  'This activation code has already been used': 'plans.errors.codeUsed',
  'This activation code does not have a plan assigned': 'plans.errors.noPlanAssigned',
  'The plan associated with this code is no longer available': 'plans.errors.planUnavailable',
  'Only tenant owners can change the plan': 'plans.errors.notOwner',
  'Failed to claim activation code': 'plans.errors.claimFailed',
  'activation_code is required': 'plans.errors.codeRequired',
};

// ─── Component ──────────────────────────────────────────────

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const { currentTenant, refreshTenant, refreshSetup } = useTenant();
  const { formatPrice: formatCurrency } = useCurrency();
  const navigate = useNavigate();

  // Data
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  // Alerts
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Modals
  const [interestModalOpen, setInterestModalOpen] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Expired subscription detection
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';

  // Activation code state
  const [activationCode, setActivationCode] = useState('');
  const [codeError, setCodeError] = useState('');

  // ─── Effects ────────────────────────────────────────────

  useEffect(() => {
    if (currentTenant) loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  // Handle Stripe checkout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success') {
      navigate('/dashboard/company', { replace: true, state: { toast: t('plans.planSelected') } });
    } else if (checkout === 'canceled') {
      // Update the pending payment attempt to canceled in the database
      apiClient.patch('/stripe-checkout').catch((err) => {
        console.error('Failed to cancel payment attempt:', err);
      });
      showError(t('plans.checkoutCanceled', 'Checkout was canceled'));
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Alert helpers ──────────────────────────────────────

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 5000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // ─── Data loading ───────────────────────────────────────

  const loadPlans = async () => {
    try {
      const res = await apiClient.get<{ plans: Plan[]; current_plan_id: string | null }>('/plans');
      setPlans(res.data.plans || []);
      setCurrentPlanId(res.data.current_plan_id);
    } catch {
      showError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────

  const handleStripeCheckout = async (planId: string) => {
    setSelecting(planId);
    setError('');
    try {
      const res = await apiClient.post<{ url: string }>('/stripe-checkout', {
        plan_id: planId,
        billing_interval: billingPeriod,
        locale: i18n.language,
      });
      window.location.href = res.data.url;
    } catch (err) {
      showError(err instanceof Error ? err.message : t('plans.checkoutError'));
      setSelecting(null);
    }
  };

  const handleActivate = async () => {
    if (!activationCode.trim()) return;
    setCodeError('');
    setSelecting('activation');

    try {
      await apiClient.put('/plans', { activation_code: activationCode.trim() });
      closeCodeModal();
      refreshSetup();
      showSuccess(t('plans.planSelected'));
      loadPlans();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      const key = ACTIVATION_ERROR_MAP[msg];
      setCodeError(key ? t(key) : msg);
    } finally {
      setSelecting(null);
    }
  };

  const handleCancelSubscription = async (reason: string, feedback?: string) => {
    setCancelModalOpen(false);
    setCanceling(true);
    try {
      await apiClient.post('/stripe-cancel', { reason, feedback });
      showSuccess(t('plans.cancelSuccess'));
      await refreshTenant();
      loadPlans();
    } catch (err) {
      showError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setCanceling(false);
    }
  };

  // ─── Modal helpers ──────────────────────────────────────

  const openCodeModal = () => {
    setCodeModalOpen(true);
    setActivationCode('');
    setCodeError('');
  };

  const closeCodeModal = () => {
    setCodeModalOpen(false);
    setActivationCode('');
    setCodeError('');
  };

  // ─── Derived data ───────────────────────────────────────

  const formatPrice = (plan: Plan) => {
    if ((plan.settings as Record<string, unknown>)?.custom_pricing) return t('plans.custom');
    return formatCurrency(plan.price);
  };

  const getFeatures = (plan: Plan): string[] => {
    const lang = i18n.language || 'en';
    return plan.features?.[lang] || plan.features?.['en'] || [];
  };

  const getDescription = (plan: Plan): string => {
    const settings = plan.settings as Record<string, unknown>;
    const desc = settings?.description;
    if (!desc) return '';
    if (typeof desc === 'string') return desc;
    if (typeof desc === 'object') {
      const langMap = desc as Record<string, string>;
      return langMap[i18n.language || 'en'] || langMap['en'] || '';
    }
    return '';
  };

  // ─── Loading state ──────────────────────────────────────

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

  // ─── Map plans → PricingPlan props ──────────────────────

  const pricingPlans: PricingPlan[] = plans.map((plan, idx) => {
    const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;
    const isFree = plan.price <= 0;
    const isPopular = plan.name === 'Growth';

    return {
      planId: plan.id,
      rawPrice: plan.price,
      trialDays: plan.trial,
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
        : isFree
          ? undefined
          : () => handleStripeCheckout(plan.id),
      disabled: !!selecting,
      loading: selecting === plan.id,
    };
  });

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="stagger-enter max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">{t('plans.title')}</h1>
        <p className="text-text-secondary mt-2 text-sm max-w-lg mx-auto">{t('plans.subtitle')}</p>
      </div>

      {/* Expired subscription banner */}
      {isExpired && (
        <div className="p-4 rounded-xl bg-error/10 border border-error/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-error text-sm">{t('plans.expiredTitle')}</p>
            <p className="text-text-secondary text-xs mt-1">{t('plans.expiredDesc')}</p>
          </div>
        </div>
      )}

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
        <PricingPlans
          plans={pricingPlans}
          numericPrices={plans.map(p => p.price)}
          formatPrice={formatCurrency}
          onBillingPeriodChange={setBillingPeriod}
          currentPlanId={currentPlanId}
        />
      )}

      {/* Footer actions: activation code + settings gear */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={openCodeModal}
          className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-primary/80 transition-colors font-medium"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          <Ticket className="w-4 h-4" />
          {t('plans.hasSubscription')}
        </button>

        {currentPlanId && (
          <SubscriptionSettings
            disabled={canceling}
            onCancelClick={() => setCancelModalOpen(true)}
          />
        )}
      </div>

      {/* Owner note */}
      <p className="text-center text-xs text-text-muted">
        {t('plans.ownerOnly')}
      </p>

      {/* ─── Modals ───────────────────────────────────────── */}

      <InterestFormModal
        open={interestModalOpen}
        onClose={() => setInterestModalOpen(false)}
      />

      {cancelModalOpen && (
        <CancelSubscriptionModal
          canceling={canceling}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={handleCancelSubscription}
        />
      )}

      {codeModalOpen && (
        <ActivationCodeModal
          selecting={selecting}
          onClose={closeCodeModal}
          onActivate={handleActivate}
          activationCode={activationCode}
          setActivationCode={setActivationCode}
          codeError={codeError}
        />
      )}
    </div>
  );
}
