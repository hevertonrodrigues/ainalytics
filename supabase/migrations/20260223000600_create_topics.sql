-- ============================================================
-- Migration: Create topics table
-- ============================================================

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topics_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Index on tenant_id (required)
CREATE INDEX IF NOT EXISTS idx_topics_tenant_id
  ON topics(tenant_id);

-- Enable RLS
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
CREATE POLICY "topics_select_own_tenant"
  ON topics FOR SELECT
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
CREATE TRIGGER set_topics_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
