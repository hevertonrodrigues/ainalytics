import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/lib/dateFormat';
import {
  X,
  Mail,
  Building2,
  Shield,
  CreditCard,
  Calendar,
  Key,
  CheckCircle2,
  ExternalLink,
  User,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CRMPipelineUser } from './types';

interface UserDetailModalProps {
  user: CRMPipelineUser;
  onClose: () => void;
}

export function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stageColor: Record<string, string> = {
    registered: 'text-warning',
    email_confirmed: 'text-chart-cyan',
    subscribed_stripe: 'text-success',
    subscribed_activation: 'text-brand-primary',
    cancelled: 'text-error',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg-primary/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-bg-secondary/95 backdrop-blur-xl border border-glass-border rounded-lg shadow-2xl overflow-hidden animate-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <User className="w-5 h-5 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-1.5">
                {user.full_name || t('sa.unnamedUser')}
                {user.is_sa && <Shield className="w-4 h-4 text-brand-accent" />}
              </h2>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Mail className="w-3 h-3" /> {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-glass-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Stage badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{t('sa.stage')}:</span>
            <span className={`text-sm font-semibold uppercase ${stageColor[user.stage] || 'text-text-muted'}`}>
              {t(`sa.stage_${user.stage}`)}
            </span>
          </div>

          {/* Auth Info */}
          <Section title={t('sa.authInfo')}>
            <Row icon={<CheckCircle2 className="w-3.5 h-3.5" />} label={t('sa.emailConfirmed')} 
              value={user.email_confirmed_at ? formatDateTime(user.email_confirmed_at, 'dateTime') : '—'}
              valueClass={user.email_confirmed_at ? 'text-success' : 'text-error'} />
            <Row icon={<Calendar className="w-3.5 h-3.5" />} label={t('sa.lastSignIn')} 
              value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at, 'dateTime') : '—'} />
            <Row icon={<Globe className="w-3.5 h-3.5" />} label={t('sa.locale')} value={user.locale} />
            <Row icon={<Calendar className="w-3.5 h-3.5" />} label={t('sa.registered')} 
              value={formatDateTime(user.created_at, 'dateTime')} />
          </Section>

          {/* Tenant & Company */}
          <Section title={t('sa.tenantInfo')}>
            <Row icon={<Building2 className="w-3.5 h-3.5" />} label={t('sa.tenant')} value={user.tenant_name || '—'} />
            <Row icon={<Building2 className="w-3.5 h-3.5" />} label={t('sa.company')} value={user.company_name || user.company_domain || '—'} />
            {user.company_industry && (
              <Row icon={<Building2 className="w-3.5 h-3.5" />} label={t('sa.industry')} value={user.company_industry} />
            )}
            {user.company_country && (
              <Row icon={<Globe className="w-3.5 h-3.5" />} label={t('sa.country')} value={user.company_country} />
            )}
          </Section>

          {/* Subscription */}
          <Section title={t('sa.subscriptionInfo')}>
            <Row icon={<CreditCard className="w-3.5 h-3.5" />} label={t('sa.colPlan')} 
              value={user.plan_name || t('sa.noPlan')}
              valueClass={user.plan_name ? 'text-brand-primary font-medium' : ''} />
            <Row icon={<CreditCard className="w-3.5 h-3.5" />} label={t('sa.status')} 
              value={user.subscription_status?.replace('_', ' ') || '—'}
              valueClass={
                ['active', 'trialing'].includes(user.subscription_status || '') ? 'text-success' : 
                user.subscription_status === 'canceled' ? 'text-error' : ''
              } />
            {user.stripe_subscription_id && (
              <Row icon={<Key className="w-3.5 h-3.5" />} label={t('sa.stripeSub')} value={user.stripe_subscription_id} mono />
            )}
            {user.activation_code && (
              <Row icon={<Key className="w-3.5 h-3.5" />} label={t('sa.activationCode')} value={user.activation_code} mono />
            )}
            {user.paid_amount > 0 && (
              <Row icon={<CreditCard className="w-3.5 h-3.5" />} label={t('sa.amount')} 
                value={`$${user.paid_amount} / ${user.billing_interval}`} />
            )}
          </Section>

          {/* Payment */}
          {user.total_payment_attempts > 0 && (
            <Section title={t('sa.paymentInfo')}>
              <Row icon={<CreditCard className="w-3.5 h-3.5" />} label={t('sa.lastPayment')} 
                value={`${user.last_payment_status} — $${user.last_payment_amount}`}
                valueClass={user.last_payment_status === 'succeeded' ? 'text-success' : 'text-error'} />
              <Row icon={<Calendar className="w-3.5 h-3.5" />} label={t('sa.paymentDate')} 
                value={user.last_payment_at ? formatDateTime(user.last_payment_at, 'dateTime') : '—'} />
              <Row icon={<CreditCard className="w-3.5 h-3.5" />} label={t('sa.totalPayments')} 
                value={String(user.total_payment_attempts)} />
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-glass-border flex justify-between items-center">
          <button
            onClick={() => { onClose(); navigate(`/sa/users/${user.user_id}`); }}
            className="flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-accent transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('sa.viewFullDetails')}
          </button>
          <button
            onClick={onClose}
            className="btn btn-secondary text-sm py-1.5 px-4"
          >
            {t('sa.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helpers
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, valueClass = '', mono = false }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-text-muted">{icon} {label}</span>
      <span className={`text-text-secondary ${valueClass} ${mono ? 'font-mono text-xs' : ''} truncate max-w-[50%] text-right`}>
        {value}
      </span>
    </div>
  );
}
