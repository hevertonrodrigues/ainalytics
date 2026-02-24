-- ============================================================
-- RLS policies for platforms, models, and tenant_platform_models
-- is_sa users can manage platforms & models
-- All tenant users can manage their own tenant_platform_models
-- ============================================================

-- ── 1. Platforms: is_sa can INSERT/UPDATE/DELETE ────────────

CREATE POLICY platforms_insert_sa ON platforms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

CREATE POLICY platforms_update_sa ON platforms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

CREATE POLICY platforms_delete_sa ON platforms
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

-- ── 2. Models: is_sa can INSERT/UPDATE/DELETE ──────────────

CREATE POLICY models_insert_sa ON models
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

CREATE POLICY models_update_sa ON models
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

CREATE POLICY models_delete_sa ON models
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_sa = true
    )
  );

-- ── 3. tenant_platform_models: tenant users can INSERT/UPDATE/DELETE ──

CREATE POLICY tpm_insert_own_tenant ON tenant_platform_models
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

CREATE POLICY tpm_update_own_tenant ON tenant_platform_models
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

CREATE POLICY tpm_delete_own_tenant ON tenant_platform_models
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );
