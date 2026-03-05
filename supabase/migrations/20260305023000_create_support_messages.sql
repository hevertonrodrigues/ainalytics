-- Create table: support_messages
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on tenant_id (REQUIRED)
CREATE INDEX IF NOT EXISTS idx_support_messages_tenant_id
  ON support_messages(tenant_id);

-- Index on user_id for user-specific lookups
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id
  ON support_messages(user_id);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_support_messages_status
  ON support_messages(status);

-- Enable RLS (REQUIRED)
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
CREATE POLICY "support_messages_select_own_tenant"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for 'authenticated'
-- Mutations happen via Edge Functions using service_role

-- Updated_at trigger
CREATE TRIGGER set_support_messages_updated_at
  BEFORE UPDATE ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
