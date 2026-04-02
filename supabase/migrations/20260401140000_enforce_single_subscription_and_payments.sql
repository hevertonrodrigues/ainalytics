-- ============================================================
-- Migration: Enforce single active subscription per tenant
--            + Create payments table
-- ============================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. PARTIAL UNIQUE INDEX — max 1 non-canceled subscription per tenant
-- ═══════════════════════════════════════════════════════════════

-- Before creating the index, cancel duplicate subscriptions
-- (keep the most recently created one for each tenant)
WITH ranked AS (
  SELECT id,
         tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS rn
  FROM subscriptions
  WHERE status NOT IN ('canceled', 'incomplete_expired')
)
UPDATE subscriptions
SET status = 'canceled',
    canceled_at = now()
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_tenant
  ON subscriptions(tenant_id)
  WHERE status NOT IN ('canceled', 'incomplete_expired');

-- ═══════════════════════════════════════════════════════════════
-- 2. PAYMENTS TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE payment_source AS ENUM ('stripe', 'manual', 'activation_code');
CREATE TYPE payment_record_status AS ENUM ('succeeded', 'refunded', 'pending');

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id           UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Payment source
  source                    payment_source NOT NULL DEFAULT 'stripe',

  -- Stripe-specific
  stripe_payment_intent_id  TEXT,
  stripe_invoice_id         TEXT,
  stripe_charge_id          TEXT,

  -- Manual-specific
  payment_method            TEXT,          -- 'bank_transfer', 'pix', 'cash', etc.
  reference_number          TEXT,          -- receipt / transaction ID
  notes                     TEXT,
  registered_by             UUID,          -- SA user who registered it

  -- Common fields
  amount                    NUMERIC NOT NULL DEFAULT 0,
  currency                  TEXT NOT NULL DEFAULT 'usd',
  status                    payment_record_status NOT NULL DEFAULT 'succeeded',
  paid_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_source ON payments(source);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_invoice ON payments(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
DROP POLICY IF EXISTS "payments_select_own_tenant" ON payments;
CREATE POLICY "payments_select_own_tenant"
  ON payments FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_payments_updated_at ON payments;
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 3. BACKFILL payments FROM payment_attempts
-- ═══════════════════════════════════════════════════════════════

INSERT INTO payments (
  tenant_id, subscription_id, source,
  stripe_payment_intent_id, stripe_invoice_id,
  amount, currency, status, paid_at, created_at
)
SELECT
  pa.tenant_id,
  pa.subscription_id,
  'stripe'::payment_source,
  pa.stripe_payment_intent_id,
  pa.stripe_invoice_id,
  pa.amount,
  pa.currency,
  'succeeded'::payment_record_status,
  pa.created_at,   -- use created_at as paid_at
  pa.created_at
FROM payment_attempts pa
WHERE pa.status = 'succeeded'
ON CONFLICT DO NOTHING;
