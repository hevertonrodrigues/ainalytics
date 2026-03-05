-- ============================================================
-- Table: subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('active','past_due','canceled','trialing','incomplete','incomplete_expired','paused','unpaid')),
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','yearly')),
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
DROP POLICY IF EXISTS "subscriptions_select_own_tenant" ON subscriptions;
CREATE POLICY "subscriptions_select_own_tenant"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: payment_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('succeeded','failed','pending','requires_action')),
  failure_reason TEXT,
  stripe_event_type TEXT,
  raw_event JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_attempts_tenant_id ON payment_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_subscription_id ON payment_attempts(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_stripe_pi ON payment_attempts(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
DROP POLICY IF EXISTS "payment_attempts_select_own_tenant" ON payment_attempts;
CREATE POLICY "payment_attempts_select_own_tenant"
  ON payment_attempts FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_payment_attempts_updated_at ON payment_attempts;
CREATE TRIGGER set_payment_attempts_updated_at
  BEFORE UPDATE ON payment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Trigger: prevent deleting plans with active subscriptions
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_plan_delete_with_active_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE plan_id = OLD.id
      AND status IN ('active', 'past_due', 'trialing')
  ) THEN
    RAISE EXCEPTION 'Cannot delete plan with active subscriptions';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_plan_delete ON plans;
CREATE TRIGGER trg_prevent_plan_delete
  BEFORE DELETE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION prevent_plan_delete_with_active_subscriptions();

-- ============================================================
-- Trigger: prevent deleting tenants with active subscriptions
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_tenant_delete_with_active_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE tenant_id = OLD.id
      AND status IN ('active', 'past_due', 'trialing')
  ) THEN
    RAISE EXCEPTION 'Cannot delete tenant with active subscriptions';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_tenant_delete ON tenants;
CREATE TRIGGER trg_prevent_tenant_delete
  BEFORE DELETE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION prevent_tenant_delete_with_active_subscriptions();
