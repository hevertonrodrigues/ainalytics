import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Bot, FolderOpen, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrency } from '@/hooks/useCurrency';
import { apiClient } from '@/lib/api';
import { suggestCompanyNameFromDomain } from '@/lib/email';
import { extractRootDomain } from '@/lib/domain';
import type { PricingPlan } from '@/components/PricingPlans';
import type { Plan } from '@/types';

import type { PreAnalyzeResult, StepConfig } from './types';
import { OnboardingHeader } from './OnboardingHeader';
import { ExplanationStep } from './ExplanationStep';
import { AnalyzeForm } from './AnalyzeForm';
import { AnalyzeResults } from './AnalyzeResults';
import { CategoryInfoModal } from './CategoryInfoModal';
import { PlansSelection } from './PlansSelection';

// ─── Step config ────────────────────────────────────────────
const STEPS: StepConfig[] = [
  { key: 'company', icon: Globe, color: 'from-emerald-500 to-teal-600' },
  { key: 'categories_prompts', icon: FolderOpen, color: 'from-blue-500 to-indigo-600' },
  { key: 'models', icon: Bot, color: 'from-purple-500 to-fuchsia-600' },
  { key: 'results', icon: BarChart3, color: 'from-amber-500 to-orange-600' },
];

const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'protonmail.com', 'icloud.com', 'mail.com', 'zoho.com',
]);

function getEmailDomain(email: string | undefined): string | null {
  if (!email) return null;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || PUBLIC_DOMAINS.has(domain)) return null;
  return domain;
}

// ─── Main Component ─────────────────────────────────────────
export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { currentTenant, setHasCompany, updateTenantPlanId } = useTenant();
  const { formatPrice: formatCurrency } = useCurrency();
  const navigate = useNavigate();

  // Redirect to company page if user already has a plan
  useEffect(() => {
    if (currentTenant?.plan_id) {
      navigate('/dashboard/company', { replace: true });
    }
  }, [currentTenant?.plan_id, navigate]);

  // ─── State ──────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [domain, setDomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PreAnalyzeResult | null>(null);
  const [error, setError] = useState('');
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const [companyExists, setCompanyExists] = useState(false);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [codeModalPlanId, setCodeModalPlanId] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [interestModalOpen, setInterestModalOpen] = useState(false);

  // ─── Effects ────────────────────────────────────────────
  // Fetch company on mount — if it exists, jump to analyze step
  useEffect(() => {
    apiClient.get<any>('/company').then((res) => {
      if (res.data) {
        setCompanyExists(true);
        setHasCompany(true);
        setStep(STEPS.length);
        if (res.data.domain) {
          setDomain(res.data.domain);
          setCompanyName(res.data.company_name || suggestCompanyNameFromDomain(extractRootDomain(res.data.domain) || res.data.domain));
        }
      } else {
        const emailDomain = getEmailDomain(profile?.email);
        if (emailDomain) {
          setDomain(emailDomain);
          setCompanyName(suggestCompanyNameFromDomain(extractRootDomain(emailDomain) || emailDomain));
        }
      }
    }).catch(() => {
      const emailDomain = getEmailDomain(profile?.email);
      if (emailDomain) {
        setDomain(emailDomain);
        setCompanyName(suggestCompanyNameFromDomain(extractRootDomain(emailDomain) || emailDomain));
      }
    });
  }, [setHasCompany]);

  // Fetch plans when results are shown
  useEffect(() => {
    if (!result) return;
    apiClient.get<{ plans: Plan[]; current_plan_id: string | null }>('/plans')
      .then((res) => {
        setPlans(res.data.plans || []);
        setCurrentPlanId(res.data.current_plan_id);
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, [result]);

  // ─── Computed ───────────────────────────────────────────
  const totalSteps = STEPS.length + 1;
  const isLastExplanationStep = step === STEPS.length - 1;
  const isAnalyzeStep = step === STEPS.length;

  // ─── Handlers ───────────────────────────────────────────
  const handleDomainChange = useCallback((value: string) => {
    setDomain(value);
    const root = extractRootDomain(value) || value;
    if (root && root.includes('.')) {
      setCompanyName(suggestCompanyNameFromDomain(root));
    }
  }, []);

  const goNext = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection('next');
      setStep((s) => s + 1);
    }
  }, [step, totalSteps]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection('prev');
      setStep((s) => s - 1);
      if (result) setResult(null);
    }
  }, [step, result]);

  const skipToPlans = useCallback(async () => {
    try { await apiClient.put('/users-me', { has_seen_onboarding: true }); } catch {}
    navigate('/dashboard/plans', { replace: true });
  }, [navigate]);

  const handleAnalyze = useCallback(async () => {
    if (!domain.trim()) return;
    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      if (companyExists) {
        await apiClient.patch('/company', {
          domain: domain.trim(),
          company_name: companyName.trim() || null,
        });
      } else {
        await apiClient.post('/company', {
          domain: domain.trim(),
          description: '',
          target_language: 'en',
        });
        setHasCompany(true);
        setCompanyExists(true);
      }

      const res = await apiClient.post<PreAnalyzeResult>('/scrape-company', {
        action: 'pre-analyze',
        domain: domain.trim(),
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setAnalyzing(false);
    }
  }, [domain, companyName, companyExists, t, setHasCompany]);

  // Plan selection handlers
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
      try { await apiClient.put('/users-me', { has_seen_onboarding: true }); } catch {}
      navigate('/dashboard/company', { replace: true });
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSelecting(null);
    }
  };

  // Build pricing plans array
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
      const lang = i18n.language || 'en';
      return langMap[lang] || langMap['en'] || '';
    }
    return '';
  };

  const pricingPlans: PricingPlan[] = plans.map((plan, idx) => {
    const isCurrentPlan = plan.id === currentPlanId;
    const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;
    const isPopular = plan.name === 'Growth';
    return {
      name: plan.name,
      price: isCustom ? t('plans.custom') : formatCurrency(plan.price),
      priceLabel: plan.price > 0 ? t('plans.perMonth') : undefined,
      description: getDescription(plan),
      features: getFeatures(plan),
      popular: isPopular ? t('plans.mostPopular') : undefined,
      isBlock: idx >= 3,
      cta: isCustom ? t('plans.contactSales') : t('plans.selectPlan'),
      onSelect: isCustom
        ? () => setInterestModalOpen(true)
        : isCurrentPlan ? undefined : () => openCodeModal(plan.id),
      disabled: !!selecting,
      loading: selecting === plan.id,
      statusLabel: isCurrentPlan ? t('plans.currentPlan') : undefined,
    };
  });

  // ─── Render: Explanation Steps ────────────────────────────
  if (!isAnalyzeStep) {
    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={totalSteps} onSkip={skipToPlans} />
        <ExplanationStep
          step={step}
          stepConfig={STEPS[step]!}
          isLast={isLastExplanationStep}
          direction={direction}
          onNext={goNext}
          onPrev={goPrev}
        />
      </div>
    );
  }

  // ─── Render: Analyze Step ─────────────────────────────────
  return (
    <>
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={totalSteps} onSkip={skipToPlans} />

        {result ? (
          <AnalyzeResults result={result} onShowCategoryInfo={() => setShowCategoryInfo(true)}>
            <PlansSelection
              pricingPlans={pricingPlans}
              plansLoading={plansLoading}
              codeModalPlanId={codeModalPlanId}
              activationCode={activationCode}
              codeError={codeError}
              selecting={selecting}
              interestModalOpen={interestModalOpen}
              onCloseCodeModal={closeCodeModal}
              onActivate={handleActivate}
              onSetActivationCode={setActivationCode}
              onCloseInterestModal={() => setInterestModalOpen(false)}
            />
          </AnalyzeResults>
        ) : (
          <AnalyzeForm
            domain={domain}
            companyName={companyName}
            analyzing={analyzing}
            error={error}
            onDomainChange={handleDomainChange}
            onCompanyNameChange={setCompanyName}
            onAnalyze={handleAnalyze}
            onBack={goPrev}
            onSkip={skipToPlans}
          />
        )}
      </div>

      {showCategoryInfo && (
        <CategoryInfoModal onClose={() => setShowCategoryInfo(false)} />
      )}
    </>
  );
}
