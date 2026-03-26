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
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { CRMPipelineUser } from './types';
import { CreateProposalModal } from './CreateProposalModal';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [user, setUser] = useState<CRMPipelineUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  // deno-lint-ignore no-explicit-any
  const [proposals, setProposals] = useState<any[]>([]);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

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

  const fetchProposals = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiClient.get<any[]>(`/proposals?user_id=${userId}`);
      setProposals(res.data || []);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  async function copyProposalLink(slug: string) {
    const url = `${window.location.origin}/proposal/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  async function deleteProposal(id: string) {
    if (!confirm(t('proposal.deleteConfirm'))) return;
    try {
      await apiClient.delete(`/proposals/${id}`);
      fetchProposals();
    } catch { /* ignore */ }
  }

  async function markAsSent(id: string) {
    try {
      await apiClient.put(`/proposals/${id}`, { status: 'sent' });
      fetchProposals();
    } catch { /* ignore */ }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-text-muted/10 text-text-muted border-text-muted/20',
    sent: 'bg-chart-cyan/10 text-chart-cyan border-chart-cyan/30',
    viewed: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    accepted: 'bg-success/10 text-success border-success/30',
    expired: 'bg-error/10 text-error border-error/30',
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
    subscribed_stripe: 'bg-success/10 text-success border-success/30',
    subscribed_activation: 'bg-brand-primary/10 text-brand-primary border-brand-primary/30',
    cancelled: 'bg-error/10 text-error border-error/30',
  };

  return (
    <div className="stagger-enter space-y-6 max-w-4xl">
      {/* Back button */}
      <button onClick={() => navigate('/sa')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('sa.backToPipeline')}
      </button>

      {/* Header card */}
      <div className="dashboard-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <User className="w-7 h-7 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
                {user.full_name || t('sa.unnamedUser')}
                {user.is_sa && <Shield className="w-5 h-5 text-brand-accent" />}
              </h1>
              <p className="text-sm text-text-muted flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" /> {user.email}
              </p>
              <p className="text-xs text-text-muted mt-1">
                ID: <span className="font-mono">{user.user_id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProposalModal(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              {t('proposal.createProposal')}
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${stageColor[user.stage] || ''}`}>
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
          <DetailRow label={t('sa.colPlan')} icon={<CreditCard className="w-3.5 h-3.5" />}>
            {user.plan_name ? (
              <span className="text-brand-primary font-medium">{user.plan_name}</span>
            ) : <span className="text-text-muted italic">{t('sa.noPlan')}</span>}
          </DetailRow>
          <DetailRow label={t('sa.status')} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            <span className={
              ['active', 'trialing'].includes(user.subscription_status || '') ? 'text-success font-medium' :
              user.subscription_status === 'canceled' ? 'text-error' : 'text-text-secondary'
            }>
              {user.subscription_status?.replace('_', ' ') || '—'}
            </span>
          </DetailRow>
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
          {user.current_period_start && (
            <DetailRow label={t('sa.period')} icon={<Calendar className="w-3.5 h-3.5" />}>
              {formatDate(user.current_period_start)} — {user.current_period_end ? formatDate(user.current_period_end) : '—'}
            </DetailRow>
          )}
          {user.cancel_at_period_end && (
            <DetailRow label={t('sa.cancelAtPeriodEnd')} icon={<XCircle className="w-3.5 h-3.5 text-warning" />}>
              <span className="text-warning font-medium">{t('sa.yes')}</span>
            </DetailRow>
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

        {/* Payment History */}
        <DetailCard title={t('sa.paymentInfo')} icon={<CreditCard className="w-4 h-4" />} className={user.activation_code ? '' : 'md:col-span-1'}>
          {user.total_payment_attempts > 0 ? (
            <>
              <DetailRow label={t('sa.totalPayments')} icon={<CreditCard className="w-3.5 h-3.5" />}>
                <span className="font-medium">{user.total_payment_attempts}</span>
              </DetailRow>
              <DetailRow label={t('sa.lastPayment')} icon={<CreditCard className="w-3.5 h-3.5" />}>
                <span className={user.last_payment_status === 'succeeded' ? 'text-success' : 'text-error'}>
                  {user.last_payment_status} — ${user.last_payment_amount}
                </span>
              </DetailRow>
              {user.last_payment_at && (
                <DetailRow label={t('sa.paymentDate')} icon={<Calendar className="w-3.5 h-3.5" />}>
                  {formatDateTime(user.last_payment_at, 'dateTime')}
                </DetailRow>
              )}
            </>
          ) : (
            <p className="text-sm text-text-muted italic py-2">{t('sa.noPayments')}</p>
          )}
        </DetailCard>
      </div>

      {/* Proposals section */}
      <DetailCard title={t('proposal.proposals')} icon={<FileText className="w-4 h-4" />} className="">
        {proposals.length > 0 ? (
          <div className="space-y-3">
            {proposals.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-4 bg-glass-element rounded-lg px-4 py-3 border border-glass-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-text-primary truncate">{p.custom_plan_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusColors[p.status] || ''}`}>
                      {t(`proposal.status${p.status.charAt(0).toUpperCase() + p.status.slice(1)}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>${p.custom_price}{p.billing_interval === 'monthly' ? t('proposal.perMonth') : t('proposal.perYear')}</span>
                    <span>{formatDate(p.created_at)}</span>
                    {p.viewed_at && (
                      <span className="flex items-center gap-1 text-brand-primary">
                        <Eye className="w-3 h-3" /> {formatDateTime(p.viewed_at, 'dateTime')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.status === 'draft' && (
                    <button
                      onClick={() => markAsSent(p.id)}
                      className="px-2 py-1 rounded-md bg-chart-cyan/10 text-chart-cyan hover:bg-chart-cyan/20 text-xs font-medium transition-colors"
                    >
                      {t('proposal.markAsSent')}
                    </button>
                  )}
                  <button
                    onClick={() => copyProposalLink(p.slug)}
                    className="p-1.5 rounded-md hover:bg-glass-element transition-colors text-text-muted hover:text-brand-primary"
                    title={t('proposal.copyLink')}
                  >
                    {copiedSlug === p.slug ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => deleteProposal(p.id)}
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
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        onCreated={fetchProposals}
        userId={user.user_id}
        tenantId={user.tenant_id ?? undefined}
        userName={user.full_name || user.email || undefined}
      />
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
