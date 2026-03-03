-- Migration: 20260303153000_add_tenant_id_to_companies.sql
-- Description: Adds tenant_id directly to companies table as a mandatory FK to tenants.
-- The tenant_companies join table still works for RLS but tenant_id on companies
-- ensures every company belongs to exactly one tenant.

-- Step 1: Add column as nullable first (existing rows need backfill)
ALTER TABLE companies ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Backfill from tenant_companies
UPDATE companies c
SET tenant_id = tc.tenant_id
FROM tenant_companies tc
WHERE tc.company_id = c.id
  AND c.tenant_id IS NULL;

-- Step 3: Make it NOT NULL after backfill
ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL;

-- Step 4: Index for fast lookups
CREATE INDEX idx_companies_tenant ON companies(tenant_id);
