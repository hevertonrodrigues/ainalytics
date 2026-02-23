-- ============================================================
-- Make platforms & models universal (remove tenant_id)
-- Create tenant_platform_models junction table
-- ============================================================

-- ── 1. Drop tenant-specific objects on platforms ────────────

DROP POLICY IF EXISTS platforms_tenant_isolation ON platforms;
DROP INDEX IF EXISTS idx_platforms_tenant_id;
ALTER TABLE platforms DROP CONSTRAINT IF EXISTS platforms_tenant_slug_unique;

-- ── 2. Drop tenant-specific objects on models ──────────────

DROP POLICY IF EXISTS models_tenant_isolation ON models;
DROP INDEX IF EXISTS idx_models_tenant_id;
ALTER TABLE models DROP CONSTRAINT IF EXISTS models_tenant_platform_slug_unique;

-- ── 3. Remove tenant_id columns ────────────────────────────

-- Before dropping, we need to handle potential duplicate slugs
-- across tenants. Keep only one row per unique slug (platforms)
-- and one row per unique (platform_id, slug) (models).

-- De-duplicate platforms: keep the oldest row per slug
DELETE FROM platforms a
USING platforms b
WHERE a.slug = b.slug
  AND a.created_at > b.created_at;

-- De-duplicate models: keep the oldest row per (platform_id, slug)
DELETE FROM models a
USING models b
WHERE a.platform_id = b.platform_id
  AND a.slug = b.slug
  AND a.created_at > b.created_at;

-- Now safe to drop tenant_id
ALTER TABLE platforms DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE models DROP COLUMN IF EXISTS tenant_id;

-- ── 4. Add new unique constraints ──────────────────────────

ALTER TABLE platforms ADD CONSTRAINT platforms_slug_unique UNIQUE (slug);
ALTER TABLE models ADD CONSTRAINT models_platform_slug_unique UNIQUE (platform_id, slug);

-- ── 5. New RLS policies: open SELECT for authenticated ─────

CREATE POLICY platforms_select_authenticated ON platforms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY models_select_authenticated ON models
  FOR SELECT TO authenticated USING (true);

-- ── 6. Create tenant_platform_models junction table ────────

CREATE TABLE IF NOT EXISTS tenant_platform_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  model_id    UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_platform_models_unique UNIQUE (tenant_id, platform_id, model_id)
);

-- Indexes
CREATE INDEX idx_tpm_tenant_id ON tenant_platform_models (tenant_id);
CREATE INDEX idx_tpm_platform_id ON tenant_platform_models (platform_id);
CREATE INDEX idx_tpm_model_id ON tenant_platform_models (model_id);

-- RLS
ALTER TABLE tenant_platform_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY tpm_select_own_tenant ON tenant_platform_models
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- Mutations via Edge Functions (service_role bypasses RLS)

-- Updated_at trigger
CREATE TRIGGER set_tenant_platform_models_updated_at
  BEFORE UPDATE ON tenant_platform_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
