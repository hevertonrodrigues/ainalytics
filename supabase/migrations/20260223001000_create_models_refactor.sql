-- ============================================================
-- 1. Create models table (seeded with platform models)
-- 2. Alter platforms: replace default_model TEXT with default_model_id FK
-- 3. Add platform_id FK to prompt_answers
-- 4. Drop topic_platforms table
-- ============================================================

-- ── 1. Models table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS models (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform_id  UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT models_tenant_platform_slug_unique UNIQUE (tenant_id, platform_id, slug)
);

CREATE INDEX idx_models_tenant_id ON models (tenant_id);
CREATE INDEX idx_models_platform_id ON models (platform_id);

ALTER TABLE models ENABLE ROW LEVEL SECURITY;
CREATE POLICY models_tenant_isolation ON models
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ── 2. Alter platforms: add default_model_id, drop default_model ──
ALTER TABLE platforms ADD COLUMN default_model_id UUID REFERENCES models(id);
ALTER TABLE platforms DROP COLUMN IF EXISTS default_model;

-- ── 3. Add platform_id FK to prompt_answers ──
ALTER TABLE prompt_answers ADD COLUMN platform_id UUID REFERENCES platforms(id);

-- ── 4. Drop topic_platforms ──
DROP TABLE IF EXISTS topic_platforms;
