-- ============================================================
-- Fix Infinite Recursion in RLS
-- Replaces direct subqueries on tenant_users with the SECURITY DEFINER 
-- function get_auth_tenant_ids() to prevent recursive policy evaluation.
-- ============================================================

-- 1. tenants
DROP POLICY IF EXISTS "tenants_select_own" ON tenants;
CREATE POLICY "tenants_select_own"
  ON tenants FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_auth_tenant_ids()));

-- 2. profiles
DROP POLICY IF EXISTS "profiles_select_same_tenant" ON profiles;
CREATE POLICY "profiles_select_same_tenant"
  ON profiles FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_auth_tenant_ids()));

-- 3. tenant_users
DROP POLICY IF EXISTS "tenant_users_select_same_tenant" ON tenant_users;
CREATE POLICY "tenant_users_select_same_tenant"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_auth_tenant_ids()));

-- Removed tenant_settings (table no longer exists)

-- 5. topics
DROP POLICY IF EXISTS "topics_select_own_tenant" ON topics;
CREATE POLICY "topics_select_own_tenant"
  ON topics FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_auth_tenant_ids()));

-- 6. prompts
DROP POLICY IF EXISTS "prompts_select_own_tenant" ON prompts;
CREATE POLICY "prompts_select_own_tenant"
  ON prompts FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_auth_tenant_ids()));

-- 7. tenant_platform_models
DROP POLICY IF EXISTS "tpm_select_own_tenant" ON tenant_platform_models;
CREATE POLICY "tpm_select_own_tenant"
  ON tenant_platform_models FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_auth_tenant_ids()));
