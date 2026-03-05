-- ============================================================
-- Migration: Remove plan_id from tenants, use subscriptions table
-- ============================================================

-- 1. Add 'unique' to subscriptions.billing_interval CHECK constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_interval_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_interval_check
  CHECK (billing_interval IN ('monthly', 'yearly', 'unique'));

-- 2. Drop plan_id column and index from tenants
DROP INDEX IF EXISTS idx_tenants_plan_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS plan_id;

-- 3. Add cancel reason columns for CSAT feedback
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_feedback TEXT;
