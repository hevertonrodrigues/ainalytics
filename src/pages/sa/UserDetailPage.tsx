import { useState, useEffect, useCallback } from 'react';
import { formatDateTime, formatDate } from '@/lib/dateFormat';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Building2,
  Globe,
  CreditCard,
  Key,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  FileText,
  Copy,
  Check,
  Eye,
  Trash2,
  Pencil,
  Loader2,
  Save,
  Download,
  AlertTriangle,
  Cpu,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { CRMPipelineUser } from './types';
import { CreateProposalModal } from './CreateProposalModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { generateProposalPdf } from '@/lib/pdfProposal';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/constants';

interface ProposalItem {
  id: string;
  slug: string;
  custom_plan_name: string;
  custom_price: number;
  billing_interval: string;
  currency: string;
  custom_features: Record<string, string[]>;
  custom_description: Record<string, string>;
  notes: string | null;
  valid_until: string | null;
  theme: string;
  default_lang: string;
  plan_id: string | null;
  status: string;
  created_at: string;
  viewed_at: string | null;
}

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [user, setUser] = useState<CRMPipelineUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ProposalItem | null>(null);

  // Plan limits
  interface UserLimits {
    max_prompts: number | null;
    max_models: number | null;
    active_prompts: number;
    active_models_count: number;
    is_over_limit: boolean;
  }
  const [userLimits, setUserLimits] = useState<UserLimits | null>(null);

  // Subscription editing state
  const [editStatus, setEditStatus] = useState<string>('');
  const [editPeriodStart, setEditPeriodStart] = useState<string>('');
  const [editPeriodEnd, setEditPeriodEnd] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string>('');
  const [availablePlans, setAvailablePlans] = useState<{ id: string; name: string }[]>([]);

  // Force run prompts state
  const [isForceRunning, setIsForceRunning] = useState(false);
  const [forceRunResult, setForceRunResult] = useState<{ success: boolean; updated_targets?: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchUser() {
      try {
        const res = await apiClient.get<CRMPipelineUser[]>('/admin-crm-pipeline');
        if (!mounted) return;
        const found = res.data.find(u => u.user_id === userId);
        if (found) { setUser(found); }
        else { setError(t('sa.userNotFound')); }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : t('sa.failedLoadUser'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchUser();
    return () => { mounted = false; };
  }, [userId, t]);

  // Fetch plan limits from admin-active-users
  useEffect(() => {
    if (!userId) return;
    async function fetchLimits() {
      try {
        const res = await apiClient.get<Array<{
          user_id: string;
          max_prompts: number | null;
          max_models: number | null;
          active_prompts: number;
          active_models_count: number;
          is_over_limit: boolean;
        }>>('/admin-active-users');
        const found = res.data.find(u => u.user_id === userId);
        if (found) {
          setUserLimits({
            max_prompts: found.max_prompts,
            max_models: found.max_models,
            active_prompts: found.active_prompts,
            active_models_count: found.active_models_count,
            is_over_limit: found.is_over_limit,
          });
        }
      } catch { /* ignore */ }
    }
    fetchLimits();
  }, [userId]);

  // Sync edit fields when user data loads
  useEffect(() => {
    if (user) {
      setEditStatus(user.subscription_status || '');
      setEditPeriodStart(user.current_period_start ? user.current_period_start.slice(0, 10) : '');
      setEditPeriodEnd(user.current_period_end ? user.current_period_end.slice(0, 10) : '');
      setEditPlanId(user.subscription_plan_id || '');
    }
  }, [user]);

  // Fetch available plans
  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await apiClient.get<{ plans: { id: string; name: string }[] }>('/plans');
        setAvailablePlans(res.data.plans || []);
      } catch { /* ignore */ }
    }
    fetchPlans();
  }, []);

  const fetchProposals = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiClient.get<ProposalItem[]>(`/proposals?user_id=${userId}`);
      setProposals(res.data || []);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  async function copyProposalLink(slug: string, variant: 'simple' | 'full' = 'simple') {
    const url = `${window.location.origin}/proposal/${slug}${variant === 'full' ? '/full' : ''}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(`${slug}-${variant}`);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  async function deleteProposal(id: string) {
    try {
      await apiClient.delete(`/proposals/${id}`);
      fetchProposals();
    } catch { /* ignore */ }
    finally { setDeleteTarget(null); }
  }

  async function downloadProposalPdf(slug: string) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/proposals/public/${slug}`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.success || !json.data) return;
      const blob = await generateProposalPdf(json.data, t, json.data.default_lang || 'en');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  async function updateProposalStatus(id: string, status: string) {
    try {
      await apiClient.put(`/proposals/${id}`, { status });
      fetchProposals();
    } catch { /* ignore */ }
  }

  async function saveSubscription() {
    if (!user?.tenant_id) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await apiClient.patch('/admin-crm-pipeline', {
        tenant_id: user.tenant_id,
        status: editStatus || undefined,
        current_period_start: editPeriodStart ? new Date(editPeriodStart).toISOString() : undefined,
        current_period_end: editPeriodEnd ? new Date(editPeriodEnd).toISOString() : undefined,
        plan_id: editPlanId || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      // Re-fetch user data
      const res = await apiClient.get<CRMPipelineUser[]>('/admin-crm-pipeline');
      const found = res.data.find(u => u.user_id === userId);
      if (found) setUser(found);
    } catch { /* ignore */ }
    setIsSaving(false);
  }

  async function forceRunPrompts() {
    if (!user?.tenant_id) return;
    setIsForceRunning(true);
    setForceRunResult(null);
    try {
      const res = await apiClient.put<{ canceled_runs: number; updated_targets: number; next_due_at: string }>(
        '/admin-crm-pipeline',
        { tenant_id: user.tenant_id, action: 'force_run_prompts' }
      );
      setForceRunResult({ success: true, updated_targets: res.data.updated_targets });
      setTimeout(() => setForceRunResult(null), 4000);
    } catch {
      setForceRunResult({ success: false });
      setTimeout(() => setForceRunResult(null), 4000);
    }
    setIsForceRunning(false);
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-text-muted/10 text-text-muted border-text-muted/20',
    sent: 'bg-chart-cyan/10 text-chart-cyan border-chart-cyan/30',
    viewed: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    accepted: 'bg-success/10 text-success border-success/30',
    expired: 'bg-error/10 text-error border-error/30',
    pending_payment: 'bg-warning/10 text-warning border-warning/30',
  };

  const statusI18nKey: Record<string, string> = {
    draft: 'statusDraft',
    sent: 'statusSent',
    viewed: 'statusViewed',
    accepted: 'statusAccepted',
    expired: 'statusExpired',
    pending_payment: 'statusPendingPayment',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-glass-element rounded-md h-8 w-48" />
        <div className="animate-pulse bg-glass-element rounded-md h-64 w-full" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/sa')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('sa.backToPipeline')}
        </button>
        <div className="dashboard-card p-6 border-error border bg-error/5">
          <h3 className="text-error font-medium">{error || t('sa.userNotFound')}</h3>
        </div>
      </div>
    );
  }

  const stageColor: Record<string, string> = {
    registered: 'bg-warning/10 text-warning border-warning/30',
    email_confirmed: 'bg-chart-cyan/10 text-chart-cyan border-chart-cyan/30',
    proposal_accepted: 'bg-brand-accent/10 text-brand-accent border-brand-accent/30',
    trial_activation: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    trial_stripe: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    active_activation: 'bg-success/10 text-success border-success/30',
    active_stripe: 'bg-success/10 text-success border-success/30',
    churned_from_trial: 'bg-error/10 text-error border-error/30',
    churned_from_paid: 'bg-error/10 text-error border-error/30',
  };

  return (
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Back button */}
      <button onClick={() => navigate('/sa')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('sa.backToPipeline')}
      </button>

      {/* Header card */}
      <div className="dashboard-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 shrink-0">
              <User className="w-7 h-7 text-brand-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                {user.full_name || t('sa.unnamedUser')}
                {user.is_sa && <Shield className="w-5 h-5 text-brand-accent" />}
              </h1>
              <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {user.email}
              </p>
              <p className="text-xs text-text-muted mt-1 truncate">
                ID: <span className="font-mono">{user.user_id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {user.tenant_id && (
              <button
                onClick={forceRunPrompts}
                disabled={isForceRunning}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all border ${
                  forceRunResult?.success
                    ? 'bg-success/10 text-success border-success/30'
                    : forceRunResult && !forceRunResult.success
                    ? 'bg-error/10 text-error border-error/30'
                    : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                } disabled:opacity-50`}
              >
                {isForceRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : forceRunResult?.success ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {isForceRunning
                  ? t('sa.forceRunning')
                  : forceRunResult?.success
                  ? t('sa.forceRunSuccess', { count: forceRunResult.updated_targets || 0 })
                  : forceRunResult && !forceRunResult.success
                  ? t('sa.forceRunError')
                  : t('sa.forceRunPrompts')}
              </button>
            )}
            <button
              onClick={() => setShowProposalModal(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              {t('proposal.createProposal')}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border whitespace-nowrap ${stageColor[user.stage] || ''}`}>
              {t(`sa.stage_${user.stage}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Auth & Account */}
        <DetailCard title={t('sa.authInfo')} icon={<Shield className="w-4 h-4" />}>
          <DetailRow label={t('sa.emailConfirmed')} icon={user.email_confirmed_at ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-error" />}>
            <span className={user.email_confirmed_at ? 'text-success' : 'text-error'}>
              {user.email_confirmed_at ? formatDateTime(user.email_confirmed_at, 'dateTime') : t('sa.notConfirmed')}
            </span>
          </DetailRow>
          <DetailRow label={t('sa.lastSignIn')} icon={<Clock className="w-3.5 h-3.5" />}>
            {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at, 'dateTime') : '—'}
          </DetailRow>
          <DetailRow label={t('sa.registered')} icon={<Calendar className="w-3.5 h-3.5" />}>
            {formatDateTime(user.created_at, 'dateTime')}
          </DetailRow>
          <DetailRow label={t('sa.locale')} icon={<Globe className="w-3.5 h-3.5" />}>
            {user.locale}
          </DetailRow>
          <DetailRow label={t('sa.onboarding')} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            <span className={user.has_seen_onboarding ? 'text-success' : 'text-warning'}>
              {user.has_seen_onboarding ? t('sa.completed') : t('sa.pending')}
            </span>
          </DetailRow>
        </DetailCard>

        {/* Tenant & Company */}
        <DetailCard title={t('sa.tenantInfo')} icon={<Building2 className="w-4 h-4" />}>
          <DetailRow label={t('sa.tenant')} icon={<Building2 className="w-3.5 h-3.5" />}>
            {user.tenant_name || <span className="text-text-muted italic">—</span>}
          </DetailRow>
          {user.tenant_slug && (
            <DetailRow label={t('sa.slug')} icon={<Globe className="w-3.5 h-3.5" />}>
              <span className="font-mono text-xs">{user.tenant_slug}</span>
            </DetailRow>
          )}
          <DetailRow label={t('sa.role')} icon={<Shield className="w-3.5 h-3.5" />}>
            <span className="capitalize">{user.tenant_role || '—'}</span>
          </DetailRow>
          <DetailRow label={t('sa.company')} icon={<Building2 className="w-3.5 h-3.5" />}>
            {user.company_name || user.company_domain || <span className="text-text-muted italic">—</span>}
          </DetailRow>
          {user.company_domain && (
            <DetailRow label={t('sa.domain')} icon={<Globe className="w-3.5 h-3.5" />}>
              <a href={`https://${user.company_domain}`} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:text-brand-accent flex items-center gap-1">
                {user.company_domain} <ExternalLink className="w-3 h-3" />
              </a>
            </DetailRow>
          )}
          {user.company_industry && (
            <DetailRow label={t('sa.industry')} icon={<Building2 className="w-3.5 h-3.5" />}>
              {user.company_industry}
            </DetailRow>
          )}
          {user.company_country && (
            <DetailRow label={t('sa.country')} icon={<Globe className="w-3.5 h-3.5" />}>
              {user.company_country}
            </DetailRow>
          )}
        </DetailCard>

        {/* Subscription */}
        <DetailCard title={t('sa.subscriptionInfo')} icon={<CreditCard className="w-4 h-4" />}>
          <div className="flex items-start justify-between text-sm gap-4">
            <span className="flex items-center gap-1.5 text-text-muted shrink-0"><CreditCard className="w-3.5 h-3.5" /> {t('sa.colPlan')}</span>
            <select
              value={editPlanId}
              onChange={e => setEditPlanId(e.target.value)}
              className="bg-bg-tertiary border border-glass-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer text-right"
            >
              <option value="">{t('sa.noPlan')}</option>
              {availablePlans.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-start justify-between text-sm gap-4">
            <span className="flex items-center gap-1.5 text-text-muted shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> {t('sa.status')}</span>
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value)}
              className="bg-bg-tertiary border border-glass-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer text-right"
            >
              <option value="">—</option>
              <option value="trialing">trialing</option>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="incomplete">incomplete</option>
              <option value="paused">paused</option>
              <option value="unpaid">unpaid</option>
            </select>
          </div>
          {user.paid_amount > 0 && (
            <DetailRow label={t('sa.amount')} icon={<CreditCard className="w-3.5 h-3.5" />}>
              <span className="font-medium">${user.paid_amount} / {user.billing_interval}</span>
            </DetailRow>
          )}
          {user.stripe_subscription_id && (
            <>
              <DetailRow label={t('sa.stripeSubId')} icon={<Key className="w-3.5 h-3.5" />}>
                <span className="font-mono text-xs break-all">{user.stripe_subscription_id}</span>
              </DetailRow>
              <DetailRow label={t('sa.stripeCustomerId')} icon={<Key className="w-3.5 h-3.5" />}>
                <span className="font-mono text-xs break-all">{user.stripe_customer_id}</span>
              </DetailRow>
            </>
          )}
          <div className="flex items-start justify-between text-sm gap-4">
            <span className="flex items-center gap-1.5 text-text-muted shrink-0"><Calendar className="w-3.5 h-3.5" /> {t('sa.periodStart')}</span>
            <input
              type="date"
              value={editPeriodStart}
              onChange={e => setEditPeriodStart(e.target.value)}
              className="bg-bg-tertiary border border-glass-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer text-right"
            />
          </div>
          <div className="flex items-start justify-between text-sm gap-4">
            <span className="flex items-center gap-1.5 text-text-muted shrink-0"><Calendar className="w-3.5 h-3.5" /> {t('sa.periodEnd')}</span>
            <input
              type="date"
              value={editPeriodEnd}
              onChange={e => setEditPeriodEnd(e.target.value)}
              className="bg-bg-tertiary border border-glass-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer text-right"
            />
          </div>
          {user.cancel_at_period_end && (
            <DetailRow label={t('sa.cancelAtPeriodEnd')} icon={<XCircle className="w-3.5 h-3.5 text-warning" />}>
              <span className="text-warning font-medium">{t('sa.yes')}</span>
            </DetailRow>
          )}
          {user.tenant_id && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={saveSubscription}
                disabled={isSaving}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                  saveSuccess
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
                } disabled:opacity-50`}
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : saveSuccess ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                {isSaving ? t('sa.saving') : saveSuccess ? t('sa.saved') : t('sa.saveSubscription')}
              </button>
            </div>
          )}
        </DetailCard>

        {/* Activation Code */}
        {user.activation_code && (
          <DetailCard title={t('sa.activationInfo')} icon={<Key className="w-4 h-4" />}>
            <DetailRow label={t('sa.activationCode')} icon={<Key className="w-3.5 h-3.5" />}>
              <span className="font-mono text-sm text-brand-primary font-semibold tracking-wider">{user.activation_code}</span>
            </DetailRow>
            {user.activation_plan_name && (
              <DetailRow label={t('sa.colPlan')} icon={<CreditCard className="w-3.5 h-3.5" />}>
                {user.activation_plan_name}
              </DetailRow>
            )}
          </DetailCard>
        )}

        {/* Payment History — full list from payments table + manual register */}
        <DetailCard title={t('sa.paymentInfo')} icon={<CreditCard className="w-4 h-4" />} className={user.activation_code ? '' : 'md:col-span-1'}>
          <PaymentHistorySection tenantId={user.tenant_id} />
        </DetailCard>

        {/* Plan Limits */}
        {userLimits && (
          <DetailCard
            title={t('sa.planLimits')}
            icon={userLimits.is_over_limit ? <AlertTriangle className="w-4 h-4 text-error" /> : <CheckCircle2 className="w-4 h-4" />}
            className={userLimits.is_over_limit ? 'border border-error/30 bg-error/5' : ''}
          >
            <DetailRow label={t('sa.promptUsage')} icon={<FileText className="w-3.5 h-3.5" />}>
              <span className={userLimits.max_prompts !== null && userLimits.active_prompts > userLimits.max_prompts ? 'text-error font-semibold' : ''}>
                {userLimits.active_prompts}
                <span className="text-text-muted"> / {userLimits.max_prompts ?? t('sa.unlimited')}</span>
              </span>
            </DetailRow>
            <DetailRow label={t('sa.modelUsage')} icon={<Cpu className="w-3.5 h-3.5" />}>
              <span className={userLimits.max_models !== null && userLimits.active_models_count > userLimits.max_models ? 'text-error font-semibold' : ''}>
                {userLimits.active_models_count}
                <span className="text-text-muted"> / {userLimits.max_models ?? t('sa.unlimited')}</span>
              </span>
            </DetailRow>
            {userLimits.is_over_limit && (
              <div className="mt-2 p-2 rounded bg-error/10 border border-error/20 text-error text-xs font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('limits.overLimitTitle')}
              </div>
            )}
          </DetailCard>
        )}
      </div>

      {/* Proposals section */}
      <DetailCard title={t('proposal.proposals')} icon={<FileText className="w-4 h-4" />} className="">
        {proposals.length > 0 ? (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-bg-tertiary rounded-lg px-4 py-3 border border-glass-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-text-primary truncate">{p.custom_plan_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusColors[p.status] || ''}`}>
                      {t(`proposal.${statusI18nKey[p.status] || 'statusDraft'}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                    <span>${p.custom_price}{p.billing_interval === 'monthly' ? t('proposal.perMonth') : t('proposal.perYear')}</span>
                    <span>{formatDate(p.created_at)}</span>
                    {p.viewed_at && (
                      <span className="flex items-center gap-1 text-brand-primary">
                        <Eye className="w-3 h-3" /> {formatDateTime(p.viewed_at, 'dateTime')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <select
                    value={p.status}
                    onChange={(e) => updateProposalStatus(p.id, e.target.value)}
                    className="bg-bg-tertiary border border-glass-border rounded-md px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
                  >
                    <option value="draft">{t('proposal.statusDraft')}</option>
                    <option value="sent">{t('proposal.statusSent')}</option>
                    <option value="viewed">{t('proposal.statusViewed')}</option>
                    <option value="accepted">{t('proposal.statusAccepted')}</option>
                    <option value="expired">{t('proposal.statusExpired')}</option>
                    <option value="pending_payment">{t('proposal.statusPendingPayment')}</option>
                  </select>
                  <button
                    onClick={() => setEditTarget(p)}
                    className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-brand-primary"
                    title={t('proposal.editProposal')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => copyProposalLink(p.slug, 'simple')}
                    className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-brand-primary"
                    title={t('proposal.simpleLink')}
                  >
                    {copiedSlug === `${p.slug}-simple` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => copyProposalLink(p.slug, 'full')}
                    className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-brand-primary"
                    title={t('proposal.fullLink')}
                  >
                    {copiedSlug === `${p.slug}-full` ? <Check className="w-3.5 h-3.5 text-success" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => downloadProposalPdf(p.slug)}
                    className="p-1.5 rounded-md hover:bg-bg-elevated transition-colors text-text-muted hover:text-brand-primary"
                    title={t('proposal.downloadPdf')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p.id)}
                    className="p-1.5 rounded-md hover:bg-error/10 transition-colors text-text-muted hover:text-error"
                    title={t('proposal.deleteProposal')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-text-muted">{t('proposal.noProposals')}</p>
            <p className="text-xs text-text-muted/60 mt-1">{t('proposal.noProposalsDesc')}</p>
          </div>
        )}
      </DetailCard>

      {/* Create Proposal Modal */}
      <CreateProposalModal
        isOpen={showProposalModal || !!editTarget}
        onClose={() => { setShowProposalModal(false); setEditTarget(null); }}
        onCreated={fetchProposals}
        userId={user.user_id}
        tenantId={user.tenant_id ?? undefined}
        userName={user.full_name || user.email || undefined}
        editProposal={editTarget}
      />

      {deleteTarget && (
        <ConfirmModal
          message={t('proposal.deleteConfirm')}
          onConfirm={() => deleteProposal(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      )}
    </div>
  );
}

// ── Payment History Section ──

interface PaymentRecord {
  id: string;
  source: 'stripe' | 'manual' | 'activation_code';
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  stripe_invoice_id: string | null;
  paid_at: string;
  created_at: string;
}

function PaymentHistorySection({ tenantId }: { tenantId: string | null }) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('brl');
  const [formMethod, setFormMethod] = useState('bank_transfer');
  const [formReference, setFormReference] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaidAt, setFormPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!tenantId) { setIsLoading(false); return; }
    try {
      const res = await apiClient.get<PaymentRecord[]>(
        `/admin-crm-pipeline?entity=payments&tenant_id=${tenantId}`
      );
      setPayments(res.data || []);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [tenantId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !formAmount) return;
    setIsSubmitting(true);
    setSubmitSuccess(false);
    setSubmitError(false);
    try {
      await apiClient.post('/admin-crm-pipeline', {
        tenant_id: tenantId,
        amount: parseFloat(formAmount),
        currency: formCurrency,
        payment_method: formMethod,
        reference_number: formReference || undefined,
        notes: formNotes || undefined,
        paid_at: formPaidAt ? new Date(formPaidAt).toISOString() : undefined,
      });
      setSubmitSuccess(true);
      setFormAmount(''); setFormReference(''); setFormNotes('');
      setTimeout(() => { setSubmitSuccess(false); setShowForm(false); }, 1500);
      fetchPayments();
    } catch {
      setSubmitError(true);
      setTimeout(() => setSubmitError(false), 3000);
    }
    setIsSubmitting(false);
  }

  const sourceLabel: Record<string, string> = {
    stripe: t('sa.paymentSourceStripe'),
    manual: t('sa.paymentSourceManual'),
    activation_code: t('sa.paymentSourceActivation'),
  };

  const sourceColor: Record<string, string> = {
    stripe: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    manual: 'bg-warning/10 text-warning border-warning/30',
    activation_code: 'bg-chart-cyan/10 text-chart-cyan border-chart-cyan/30',
  };

  if (!tenantId) return <p className="text-sm text-text-muted italic py-2">{t('sa.noPayments')}</p>;
  if (isLoading) return <div className="animate-pulse bg-glass-element rounded-md h-16 w-full" />;

  return (
    <div className="space-y-3">
      {/* Payment list */}
      {payments.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-bg-tertiary rounded-lg px-3 py-2 border border-glass-border text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${sourceColor[p.source] || ''}`}>
                  {sourceLabel[p.source] || p.source}
                </span>
                <span className="text-text-muted truncate">
                  {formatDateTime(p.paid_at, 'dateTime')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.payment_method && (
                  <span className="text-text-muted">{p.payment_method}</span>
                )}
                {p.reference_number && (
                  <span className="text-text-muted font-mono" title={p.reference_number}>
                    #{p.reference_number.slice(0, 8)}
                  </span>
                )}
                <span className={`font-medium ${p.status === 'succeeded' ? 'text-success' : p.status === 'refunded' ? 'text-error' : 'text-warning'}`}>
                  {p.currency?.toUpperCase()} {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted italic py-2">{t('sa.noPayments')}</p>
      )}

      {/* Toggle form button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-1.5 text-xs text-brand-primary hover:text-brand-accent transition-colors font-medium"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('sa.registerPayment')}
      </button>

      {/* Manual payment form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2.5 p-3 bg-bg-elevated/50 rounded-lg border border-glass-border">
          <p className="text-xs text-text-muted mb-1">{t('sa.registerPaymentDesc')}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentAmount')}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentCurrency')}</label>
              <select
                value={formCurrency}
                onChange={(e) => setFormCurrency(e.target.value)}
                className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
              >
                <option value="brl">BRL</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentMethod')}</label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value)}
                className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
              >
                <option value="bank_transfer">{t('sa.paymentMethodTransfer')}</option>
                <option value="pix">{t('sa.paymentMethodPix')}</option>
                <option value="cash">{t('sa.paymentMethodCash')}</option>
                <option value="other">{t('sa.paymentMethodOther')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentPaidAt')}</label>
              <input
                type="date"
                value={formPaidAt}
                onChange={(e) => setFormPaidAt(e.target.value)}
                className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentReference')}</label>
            <input
              type="text"
              value={formReference}
              onChange={(e) => setFormReference(e.target.value)}
              className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder={t('sa.paymentReferencePlaceholder')}
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider">{t('sa.paymentNotes')}</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full bg-bg-tertiary border border-glass-border rounded-md px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
              placeholder={t('sa.paymentNotesPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 rounded-md border border-glass-border text-text-muted hover:text-text-primary transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formAmount}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                submitSuccess
                  ? 'bg-success/10 text-success border border-success/30'
                  : submitError
                  ? 'bg-error/10 text-error border border-error/30'
                  : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : submitSuccess ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
              {isSubmitting ? t('sa.paymentRegistering') : submitSuccess ? t('sa.paymentRegistered') : submitError ? t('sa.paymentRegisterError') : t('sa.registerPayment')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Helper components ──

function DetailCard({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`dashboard-card p-5 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4">
        {icon} {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, icon, children }: {
  label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <span className="flex items-center gap-1.5 text-text-muted shrink-0">{icon} {label}</span>
      <span className="text-text-secondary text-right">{children}</span>
    </div>
  );
}
