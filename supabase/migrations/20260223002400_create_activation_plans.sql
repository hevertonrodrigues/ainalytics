-- Create activation_plans table for plan activation codes
CREATE TABLE IF NOT EXISTS activation_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid REFERENCES plans(id) ON DELETE SET NULL,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE SET NULL,
  code        text NOT NULL CHECK (char_length(code) = 12),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique code constraint
ALTER TABLE activation_plans ADD CONSTRAINT activation_plans_code_unique UNIQUE (code);

-- Index for fast code lookup
CREATE INDEX idx_activation_plans_code ON activation_plans(code);
CREATE INDEX idx_activation_plans_plan_id ON activation_plans(plan_id);

-- Enable RLS but block ALL access (only edge functions with service role can access)
ALTER TABLE activation_plans ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated roles
