-- ============================================================
-- Prompt Answers: stores AI platform responses to prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_id      UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  platform_slug  TEXT NOT NULL,           -- openai, anthropic, gemini, grok, perplexity
  model          TEXT NOT NULL,           -- exact model string used
  answer_text    TEXT,                    -- response content (null if error)
  tokens_used    JSONB,                   -- { input: N, output: N }
  latency_ms     INTEGER,                -- response time in ms
  error          TEXT,                    -- error message if failed
  searched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_prompt_answers_tenant_id ON prompt_answers (tenant_id);
CREATE INDEX idx_prompt_answers_prompt_id ON prompt_answers (prompt_id);
CREATE INDEX idx_prompt_answers_searched_at ON prompt_answers (searched_at DESC);
CREATE INDEX idx_prompt_answers_platform ON prompt_answers (tenant_id, platform_slug);

-- RLS
ALTER TABLE prompt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompt_answers_tenant_isolation ON prompt_answers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
