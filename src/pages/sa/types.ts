// Shared types for admin CRM pipeline data

export interface CRMPipelineUser {
  // Profile
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  locale: string;
  is_sa: boolean;
  has_seen_onboarding: boolean;
  created_at: string;
  // Auth
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  // Tenant
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_code: string | null;
  tenant_created_at: string | null;
  tenant_role: string | null;
  // Company
  company_domain: string | null;
  company_name: string | null;
  company_industry: string | null;
  company_country: string | null;
  // Plan & Subscription
  subscription_plan_id: string | null;
  plan_name: string | null;
  plan_price: number;
  subscription_status: string | null;
  billing_interval: string | null;
  paid_amount: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_created_at: string | null;
  // Activation code
  activation_code: string | null;
  activation_plan_name: string | null;
  // Payment
  last_payment_status: string | null;
  last_payment_at: string | null;
  last_payment_amount: number;
  total_payment_attempts: number;
  // Kanban
  stage: KanbanStage;
  user_classification: 'registered' | 'trial' | 'paid' | 'churned_trial' | 'churned_paid';
  is_paid_user: boolean;
}

export type KanbanStage =
  | 'registered'
  | 'email_confirmed'
  | 'proposal_accepted'
  | 'trial_activation'
  | 'trial_stripe'
  | 'active_activation'
  | 'active_stripe'
  | 'churned_from_trial'
  | 'churned_from_paid';

export const KANBAN_STAGES: KanbanStage[] = [
  'registered',
  'email_confirmed',
  'proposal_accepted',
  'trial_activation',
  'trial_stripe',
  'active_activation',
  'active_stripe',
  'churned_from_trial',
  'churned_from_paid',
];
