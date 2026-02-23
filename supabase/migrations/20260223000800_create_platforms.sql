-- ============================================================
-- Platforms + Topic-Platform junction
-- ============================================================

-- Platforms table: registry of AI providers
CREATE TABLE IF NOT EXISTS platforms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,            -- openai, anthropic, gemini, grok, perplexity
  name        TEXT NOT NULL,            -- Display name
  is_active   BOOLEAN NOT NULL DEFAULT true,
  default_model TEXT NOT NULL,          -- Default model string for this platform
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platforms_tenant_slug_unique UNIQUE (tenant_id, slug)
);

-- Indexes
CREATE INDEX idx_platforms_tenant_id ON platforms (tenant_id);

-- RLS
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY platforms_tenant_isolation ON platforms
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Updated_at trigger
CREATE TRIGGER set_platforms_updated_at
  BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Topic-Platform junction: which platforms are enabled per topic
CREATE TABLE IF NOT EXISTS topic_platforms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  topic_id    UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_platforms_unique UNIQUE (topic_id, platform_id)
);

-- Indexes
CREATE INDEX idx_topic_platforms_tenant_id ON topic_platforms (tenant_id);
CREATE INDEX idx_topic_platforms_topic_id ON topic_platforms (topic_id);

-- RLS
ALTER TABLE topic_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY topic_platforms_tenant_isolation ON topic_platforms
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
