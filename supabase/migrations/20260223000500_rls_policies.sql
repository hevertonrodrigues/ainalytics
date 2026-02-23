-- ============================================================
-- Migration: RLS policies (SELECT only for authenticated)
-- All user references use auth.uid() against auth.users
-- ============================================================

-- ─── Tenants ───
-- Users can SELECT tenants they belong to
CREATE POLICY "tenants_select_own"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- ─── Profiles ───
-- Users can SELECT their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can SELECT profiles of members in their tenants
CREATE POLICY "profiles_select_same_tenant"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- ─── Tenant Users ───
-- Users can SELECT tenant_users records for their tenants
CREATE POLICY "tenant_users_select_same_tenant"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- ─── Tenant Settings ───
-- Users can SELECT settings for their tenants
CREATE POLICY "tenant_settings_select_same_tenant"
  ON tenant_settings FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );
