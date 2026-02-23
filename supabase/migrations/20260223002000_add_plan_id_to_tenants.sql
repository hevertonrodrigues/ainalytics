-- ============================================================
-- Migration: Add plan_id FK to tenants table
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

-- Index on plan_id
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON tenants(plan_id);
