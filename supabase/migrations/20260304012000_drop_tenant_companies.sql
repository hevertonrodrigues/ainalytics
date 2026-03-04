-- Migration: 20260304012000_drop_tenant_companies.sql
-- Description: Removes the redundant tenant_companies join table.
--              Updates all RLS policies to use companies.tenant_id directly.

-- ─── 1. Drop old RLS policies that JOIN through tenant_companies ───────

-- companies: "companies_select" (created in 20260227120100)
DROP POLICY IF EXISTS "companies_select" ON companies;

-- geo_analyses: "geo_analyses_select" (created in 20260303124000)
DROP POLICY IF EXISTS "geo_analyses_select" ON geo_analyses;

-- geo_analyses_pages: "gap_select" (created in 20260303130000)
DROP POLICY IF EXISTS "gap_select" ON geo_analyses_pages;

-- ─── 2. Recreate RLS policies using companies.tenant_id ───────────────

-- companies: direct tenant_id lookup (follows skill pattern)
CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- geo_analyses: via companies.tenant_id
CREATE POLICY "geo_analyses_select" ON geo_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      JOIN tenant_users tu ON tu.tenant_id = c.tenant_id
      WHERE c.id = geo_analyses.company_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- geo_analyses_pages: via geo_analyses → companies.tenant_id
CREATE POLICY "gap_select" ON geo_analyses_pages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM geo_analyses ga
      JOIN companies c ON c.id = ga.company_id
      JOIN tenant_users tu ON tu.tenant_id = c.tenant_id
      WHERE ga.id = geo_analyses_pages.analysis_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- company_checklist_results: only drop/recreate if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_checklist_results'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "checklist_results_select" ON company_checklist_results';
    EXECUTE '
      CREATE POLICY "checklist_results_select" ON company_checklist_results
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM companies c
            JOIN tenant_users tu ON tu.tenant_id = c.tenant_id
            WHERE c.id = company_checklist_results.company_id
              AND tu.user_id = auth.uid()
              AND tu.is_active = true
          )
        )';
  END IF;
END $$;

-- ─── 3. Drop the tenant_companies table ───────────────────────────────
-- This cascades: drops its indexes, RLS policies, and trigger automatically.

DROP TABLE IF EXISTS tenant_companies CASCADE;
