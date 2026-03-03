-- Migration: 20260227120100_create_tenant_companies.sql
-- Description: Creates the tenant_companies link table (N×N, limited to 1 company per tenant via UNIQUE constraint).

CREATE TABLE tenant_companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id),
  UNIQUE (tenant_id, company_id)
);

CREATE INDEX idx_tenant_companies_tenant ON tenant_companies(tenant_id);
CREATE INDEX idx_tenant_companies_company ON tenant_companies(company_id);

ALTER TABLE tenant_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_companies_select" ON tenant_companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_companies.tenant_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

CREATE TRIGGER set_tenant_companies_updated_at
  BEFORE UPDATE ON tenant_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policy for companies (deferred from previous migration)
CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_companies tc
      JOIN tenant_users tu ON tu.tenant_id = tc.tenant_id
      WHERE tc.company_id = companies.id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );
