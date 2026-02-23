-- ============================================================
-- Migration: Create plans table (global, no tenant_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plans
CREATE POLICY "plans_select_authenticated"
  ON plans FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for 'authenticated'
-- Mutations happen via Edge Functions using service_role

-- Updated_at trigger
CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed some default plans
INSERT INTO plans (name, price, is_active, settings) VALUES
  ('Starter', 0, true, '{"features": ["Up to 3 AI platforms", "100 prompts/month", "5 topics", "Basic analytics", "Community support"]}'),
  ('Pro', 49, true, '{"features": ["All 5 AI platforms", "Unlimited prompts", "Unlimited topics", "Advanced analytics & KPIs", "Web search grounding", "Multi-tenant workspaces", "Priority support"]}'),
  ('Enterprise', 0, true, '{"features": ["Everything in Pro", "Custom AI integrations", "SSO & SAML", "Dedicated account manager", "SLA guarantee", "On-premise deployment", "Custom reporting"], "custom_pricing": true}');
