-- ============================================================
-- Migration: Create prompts table
-- ============================================================

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompts_tenant_topic_text_unique UNIQUE (tenant_id, topic_id, text)
);

-- Index on tenant_id (required)
CREATE INDEX IF NOT EXISTS idx_prompts_tenant_id
  ON prompts(tenant_id);

-- Index on topic_id (common query pattern)
CREATE INDEX IF NOT EXISTS idx_prompts_topic_id
  ON prompts(topic_id);

-- Enable RLS
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
CREATE POLICY "prompts_select_own_tenant"
  ON prompts FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies — mutations via Edge Functions (service_role)

-- Updated_at trigger
CREATE TRIGGER set_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
