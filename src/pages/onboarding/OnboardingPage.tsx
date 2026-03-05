import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderOpen, MessageSquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrency } from '@/hooks/useCurrency';
import { apiClient } from '@/lib/api';
import { suggestCompanyNameFromDomain } from '@/lib/email';
import { extractRootDomain } from '@/lib/domain';
import type { PricingPlan, BillingPeriod } from '@/components/PricingPlans';
import type { Plan } from '@/types';

import type { PreAnalyzeResult, StepConfig } from './types';
import { OnboardingHeader } from './OnboardingHeader';
import { WelcomeStep } from './WelcomeStep';
import { SelectionStep } from './SelectionStep';
import type { OnboardingItem } from './onboardingData';
import {
  getDefaultSelectedPrompts,
  buildPromptGroups,
} from './onboardingData';
import { AnalyzeForm } from './AnalyzeForm';
import { AnalyzingOverlay } from './AnalyzingOverlay';
import { AnalyzeResults } from './AnalyzeResults';
import { CategoryInfoModal } from './CategoryInfoModal';
import { PlansSelection } from './PlansSelection';

// ─── Step config ────────────────────────────────────────────
// All steps in order:
// 0 Welcome | 1 Analyze | 2 Topics | 3 Prompts | 4 Final
const EXPLANATION_STEPS: StepConfig[] = [
  { key: 'welcome', icon: Sparkles, color: 'from-violet-500 to-purple-600' },
];

const STEP_ANALYZE = EXPLANATION_STEPS.length;     // 1
const STEP_TOPICS = EXPLANATION_STEPS.length + 1;  // 2
const STEP_PROMPTS = EXPLANATION_STEPS.length + 2; // 3
const STEP_FINAL = EXPLANATION_STEPS.length + 3;   // 4
const TOTAL_STEPS = STEP_FINAL + 1;                // 5

const TOPICS_STEP_CONFIG: StepConfig = { key: 'topics', icon: FolderOpen, color: 'from-blue-500 to-indigo-600' };
const PROMPTS_STEP_CONFIG: StepConfig = { key: 'prompts', icon: MessageSquare, color: 'from-pink-500 to-rose-600' };

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
  const { profile, refreshAuth } = useAuth();
  const { currentTenant, setHasCompany } = useTenant();
  const { formatPrice: formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect to company page if user already has a plan
  useEffect(() => {
    if (currentTenant?.active_plan_id) {
      navigate('/dashboard/company', { replace: true });
    }
  }, [currentTenant?.active_plan_id, navigate]);

  // ─── State ──────────────────────────────────────────────
  const initialStep = Math.min(Number(searchParams.get('step')) || 0, TOTAL_STEPS - 1);
  const [step, setStep] = useState(initialStep);
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
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');


  // Topics & Prompts — populated from pre-analyze response
  const [topics, setTopics] = useState<OnboardingItem[]>([]);
  const [promptsByTopic, setPromptsByTopic] = useState<Record<string, OnboardingItem[]>>({});
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set());

  // ─── Effects ────────────────────────────────────────────
  // Fetch company on mount — if it exists, jump to analyze step
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiClient.get<any>('/company').then((res) => {
      if (res.data) {
        setCompanyExists(true);
        setHasCompany(true);
        setStep(STEP_ANALYZE);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Sync step to URL param
  useEffect(() => {
    const current = Number(searchParams.get('step')) || 0;
    if (current !== step) {
      setSearchParams({ step: String(step) }, { replace: true });
    }
  }, [step, searchParams, setSearchParams]);

  // ─── Computed ───────────────────────────────────────────
  const promptGroups = useMemo(
    () => buildPromptGroups(selectedTopics, topics, promptsByTopic),
    [selectedTopics, topics, promptsByTopic],
  );

  // ─── Handlers ───────────────────────────────────────────
  const handleDomainChange = useCallback((value: string) => {
    setDomain(value);
    const root = extractRootDomain(value) || value;
    if (root && root.includes('.')) {
      setCompanyName(suggestCompanyNameFromDomain(root));
    }
  }, []);

  const goTo = useCallback((target: number) => {
    setDirection(target > step ? 'next' : 'prev');
    setStep(target);
  }, [step]);

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection('next');
      setStep((s) => s + 1);
    }
  }, [step]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection('prev');
      setStep((s) => s - 1);
    }
  }, [step]);

  const toggleTopic = useCallback((id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // enforce min 1
      } else if (next.size < 5) { // enforce max 5
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePrompt = useCallback((id: string) => {
    setSelectedPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const skipToPlans = useCallback(async () => {
    try { await apiClient.put('/users-me', { has_seen_onboarding: true }); await refreshAuth(); } catch { /* ignore */ }
    navigate('/dashboard/plans', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          company_name: companyName.trim() || null,
          description: '',
          target_language: i18n.language || 'en',
        });
        setHasCompany(true);
        setCompanyExists(true);
      }

      const res = await apiClient.post<PreAnalyzeResult>('/pre-analyze', {
        domain: domain.trim(),
        language: i18n.language || 'en',
      });
      setResult(res.data);

      // Populate topics & prompts from server response
      const serverTopics = res.data.suggested_topics || [];
      const serverPrompts = res.data.suggested_prompts || {};
      setTopics(serverTopics);
      setPromptsByTopic(serverPrompts);

      // Default selection: all topics, first 2 prompts per topic
      const defaultTopicIds = new Set(serverTopics.map(t => t.id));
      setSelectedTopics(defaultTopicIds);
      setSelectedPrompts(getDefaultSelectedPrompts(defaultTopicIds, serverPrompts));

      goTo(STEP_TOPICS); // jump to topics selection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setAnalyzing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, companyName, companyExists, t, setHasCompany]);

  // Plan selection handlers
  const openCodeModal = () => {
    setCodeModalPlanId('activation');
    setActivationCode('');
    setCodeError('');
  };

  const closeCodeModal = () => {
    setCodeModalPlanId(null);
    setActivationCode('');
    setCodeError('');
  };

  // Save selected topics & prompts to the database
  const saveSelectedTopicsAndPrompts = async () => {
    try {
      for (const group of promptGroups) {
        // Only process topics that have selected prompts
        const activePrompts = group.items.filter(p => selectedPrompts.has(p.id));
        if (activePrompts.length === 0) continue;

        // Create or find the topic
        let topicId: string;
        try {
          const topicRes = await apiClient.post<{ id: string }>('/topics-prompts', {
            name: group.groupTitle,
          });
          topicId = topicRes.data.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // If topic already exists (409), find it
          if (err.status === 409) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const topicsRes = await apiClient.get<any[]>('/topics-prompts');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = topicsRes.data.find((t: any) => t.name === group.groupTitle);
            if (found) {
              topicId = found.id;
            } else {
              console.warn(`[onboarding] Could not find existing topic: ${group.groupTitle}`);
              continue;
            }
          } else {
            console.warn(`[onboarding] Error creating topic: ${err.message}`);
            continue;
          }
        }

        // Create each selected prompt
        for (const prompt of activePrompts) {
          try {
            await apiClient.post('/topics-prompts/prompts', {
              topic_id: topicId,
              text: prompt.title,
            });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            // Skip duplicates (409)
            if (err.status !== 409) {
              console.warn(`[onboarding] Error creating prompt: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      // Don't block subscription if topic/prompt creation fails
      // (e.g., tenant membership not yet established during fresh signup)
      console.warn('[onboarding] Could not save topics/prompts (will be available after tenant setup):', err);
    }
  };

  // Create tenant_platform_models for default platforms (inactive)
  const saveDefaultPlatformModels = async () => {
    try {
      // Fetch all platforms
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const platformsRes = await apiClient.get<any[]>('/platforms');
      const defaultPlatforms = (platformsRes.data || []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.is_default && p.default_model_id
      );

      // Create a preference for each default platform
      for (const platform of defaultPlatforms) {
        try {
          await apiClient.post('/platforms/preferences', {
            platform_id: platform.id,
            model_id: platform.default_model_id,
            is_active: false,
          });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // Skip if already exists or other error
          console.warn(`[onboarding] Error creating platform preference: ${err.message}`);
        }
      }
    } catch (err) {
      console.warn('[onboarding] Could not save default platform models:', err);
    }
  };

  const handleStripeCheckout = async (planId: string) => {
    setSelecting(planId);
    try {
      // Save topics, prompts, and default platform models before redirecting to Stripe
      await Promise.all([
        saveSelectedTopicsAndPrompts(),
        saveDefaultPlatformModels(),
      ]);

      const res = await apiClient.post<{ url: string }>('/stripe-checkout', {
        plan_id: planId,
        billing_interval: billingPeriod,
        locale: i18n.language,
      });
      window.location.href = res.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setSelecting(null);
    }
  };

  const handleActivate = async () => {
    if (!activationCode.trim()) return;
    setCodeError('');
    setSelecting('activation');
    try {
      // Save topics, prompts, and default platform models before activating
      await Promise.all([
        saveSelectedTopicsAndPrompts(),
        saveDefaultPlatformModels(),
      ]);

      await apiClient.put('/plans', {
        activation_code: activationCode.trim(),
      });
      closeCodeModal();
      try { await apiClient.put('/users-me', { has_seen_onboarding: true }); await refreshAuth(); } catch { /* ignore */ }
      navigate('/dashboard/company', { replace: true });
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : t('common.error');
      const errMap: Record<string, string> = {
        'Invalid activation code': 'plans.errors.invalidCode',
        'This activation code is no longer active': 'plans.errors.codeInactive',
        'This activation code has already been used': 'plans.errors.codeUsed',
        'This activation code does not have a plan assigned': 'plans.errors.noPlanAssigned',
        'The plan associated with this code is no longer available': 'plans.errors.planUnavailable',
        'Only tenant owners can change the plan': 'plans.errors.notOwner',
        'Failed to claim activation code': 'plans.errors.claimFailed',
        'activation_code is required': 'plans.errors.codeRequired'
      };
      const translationKey = errMap[errorStr];
      setCodeError(translationKey ? t(translationKey) : errorStr);
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
    const isCustom = !!(plan.settings as Record<string, unknown>)?.custom_pricing;
    const isPopular = plan.name === 'Growth';
    const isFree = plan.price <= 0;
    return {
      planId: plan.id,
      rawPrice: plan.price,
      trialDays: plan.trial,
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
        : isFree ? undefined : () => handleStripeCheckout(plan.id),
      disabled: !!selecting,
      loading: selecting === plan.id,
    };
  });

  // ─── Render: Welcome Step (step 0) ─────────────────────────
  if (step === 0) {
    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={TOTAL_STEPS} onSkip={skipToPlans} />
        <WelcomeStep
          stepConfig={EXPLANATION_STEPS[0]!}
          direction={direction}
          onNext={goNext}
        />
      </div>
    );
  }

  // ─── Render: Analyze Form (step 4) ───────────────────────
  if (step === STEP_ANALYZE) {
    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={TOTAL_STEPS} onSkip={skipToPlans} />
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
        <AnalyzingOverlay domain={domain} visible={analyzing} />
      </div>
    );
  }

  // ─── Render: Topics Selection (step 5) ───────────────────
  if (step === STEP_TOPICS) {
    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={TOTAL_STEPS} onSkip={skipToPlans} />
        <SelectionStep
          step={step}
          stepConfig={TOPICS_STEP_CONFIG}
          direction={direction}
          isLast={false}
          items={topics}
          selectedIds={selectedTopics}
          onToggle={toggleTopic}
          onNext={goNext}
          onPrev={() => goTo(STEP_ANALYZE)}
        />
      </div>
    );
  }

  // ─── Render: Prompts Selection (step 6) ──────────────────
  if (step === STEP_PROMPTS) {
    return (
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={TOTAL_STEPS} onSkip={skipToPlans} />
        <SelectionStep
          step={step}
          stepConfig={PROMPTS_STEP_CONFIG}
          direction={direction}
          isLast={false}
          groupedItems={promptGroups}
          selectedIds={selectedPrompts}
          onToggle={togglePrompt}
          onNext={goNext}
          onPrev={goPrev}
        />
      </div>
    );
  }

  // ─── Render: Final Step (step 7) — Results + Plans ─────────
  return (
    <>
      <div className="stagger-enter min-h-[calc(100vh-8rem)] flex flex-col max-w-6xl mx-auto px-4 py-8">
        <OnboardingHeader step={step} totalSteps={TOTAL_STEPS} onSkip={skipToPlans} />

        {result ? (
          <AnalyzeResults result={result} onShowCategoryInfo={() => setShowCategoryInfo(true)}>
            {/* ── Selected Prompts — enhanced section ── */}
            <div className="relative overflow-hidden rounded-2xl border border-glass-border bg-gradient-to-br from-bg-secondary via-bg-tertiary to-bg-secondary p-6 md:p-8 mb-6">
              {/* Decorative blurs */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-primary/8 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-brand-accent/8 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shrink-0 shadow-md">
                    <MessageSquare className="w-4.5 h-4.5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-text-primary">
                    {t('onboarding.chosenPrompts')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {promptGroups.map(group => {
                    const activePrompts = group.items.filter(p => selectedPrompts.has(p.id));
                    if (activePrompts.length === 0) return null;
                    return (
                      <div
                        key={group.groupId}
                        className="rounded-xl border border-glass-border bg-bg-primary/40 p-4 transition-all duration-200 hover:border-brand-primary/30 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-brand-primary shrink-0" />
                          <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                            {group.groupTitle}
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {activePrompts.map(prompt => (
                            <div
                              key={prompt.id}
                              className="flex items-start gap-2 text-xs text-text-secondary"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                              <span>{prompt.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Improvements teaser */}
            {result.top_recommendations.length > 0 && (
              <div className="dashboard-card p-5 mb-6 text-center">
                <p className="text-lg font-bold text-brand-primary">
                  +25 {t('onboarding.analyze.improvementsFound')}
                </p>
              </div>
            )}

            <PlansSelection
              pricingPlans={pricingPlans}
              numericPrices={plans.map(p => p.price)}
              formatPrice={formatCurrency}
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
              onOpenCodeModal={openCodeModal}
              onBillingPeriodChange={setBillingPeriod}
              currentPlanId={currentPlanId}
            />
          </AnalyzeResults>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted">{t('common.loading')}</p>
          </div>
        )}
      </div>

      {showCategoryInfo && (
        <CategoryInfoModal onClose={() => setShowCategoryInfo(false)} />
      )}
    </>
  );
}
