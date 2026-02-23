-- ============================================================
-- Migration: Create plans table (global, no tenant_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
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

-- Seed default plans
INSERT INTO plans (name, price, is_active, sort_order, settings) VALUES
  ('Starter', 99, true, 1, '{"max_prompts": 3, "refresh_rate": "monthly", "description": "Essential AI monitoring to get started. Perfect for freelancers and small businesses.", "features": ["3 AI prompts", "Monthly refresh", "Up to 3 AI platforms", "Basic visibility score", "Community support"]}'),
  ('Growth', 189, true, 2, '{"max_prompts": 10, "refresh_rate": "weekly", "description": "Scale your monitoring across all AI platforms with weekly insights.", "features": ["10 AI prompts", "Weekly refresh", "All 5 AI platforms", "Advanced analytics & KPIs", "Web search grounding", "Priority support"]}'),
  ('Business', 799, true, 3, '{"max_prompts": 40, "refresh_rate": "daily", "description": "Full-power real-time monitoring for brands that demand visibility.", "features": ["40 AI prompts", "Daily refresh", "All 5 AI platforms", "Advanced analytics & KPIs", "Web search grounding", "Multi-tenant workspaces", "Dedicated support"]}'),
  ('Custom', 0, true, 4, '{"custom_pricing": true, "description": "Tailored AI monitoring solutions for agencies and large organizations.", "features": ["Unlimited prompts", "Custom refresh rate", "Custom AI integrations", "SSO & SAML", "Dedicated account manager", "SLA guarantee", "On-premise deployment", "White-label reporting"]}');
