-- ============================================================
-- AI Usage Log: comprehensive tracking of all AI API calls
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Context ───────────────────────────────────────────────
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES auth.users(id),
  call_site          TEXT NOT NULL,

  -- ── Model Info ────────────────────────────────────────────
  platform_slug      TEXT NOT NULL,
  model_slug         TEXT NOT NULL,
  model_id           UUID REFERENCES models(id),

  -- ── Request Details ───────────────────────────────────────
  prompt_text        TEXT,
  system_instruction TEXT,
  request_params     JSONB,
  raw_request        JSONB,

  -- ── Response Details ──────────────────────────────────────
  answer_text        TEXT,
  annotations        JSONB,
  sources            JSONB,
  response_params    JSONB,
  raw_response       JSONB,
  error              TEXT,

  -- ── Tokens & Cost ─────────────────────────────────────────
  tokens_input       INTEGER NOT NULL DEFAULT 0,
  tokens_output      INTEGER NOT NULL DEFAULT 0,
  price_per_input    NUMERIC(20, 12) NOT NULL DEFAULT 0,
  price_per_output   NUMERIC(20, 12) NOT NULL DEFAULT 0,
  cost_input_usd     NUMERIC(12, 8) NOT NULL DEFAULT 0,
  cost_output_usd    NUMERIC(12, 8) NOT NULL DEFAULT 0,
  cost_total_usd     NUMERIC(12, 8) NOT NULL DEFAULT 0,

  -- ── Performance ───────────────────────────────────────────
  latency_ms         INTEGER,
  web_search_enabled BOOLEAN DEFAULT false,

  -- ── References ────────────────────────────────────────────
  prompt_answer_id   UUID REFERENCES prompt_answers(id),
  metadata           JSONB,

  -- ── Timestamps ────────────────────────────────────────────
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant_id
  ON ai_usage_log (tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_tenant_created
  ON ai_usage_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_call_site
  ON ai_usage_log (call_site);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_platform
  ON ai_usage_log (platform_slug);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_model
  ON ai_usage_log (model_slug);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_prompt_answer
  ON ai_usage_log (prompt_answer_id)
  WHERE prompt_answer_id IS NOT NULL;

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- SA can see all; regular users can see their own tenant
CREATE POLICY ai_usage_log_select ON ai_usage_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_sa = true
    )
    OR tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies — mutations via service_role only

-- ── Monthly Summary Function ────────────────────────────────

CREATE OR REPLACE FUNCTION get_monthly_usage_summary(
  p_tenant_id UUID DEFAULT NULL,
  p_months    INTEGER DEFAULT 12
)
RETURNS TABLE (
  month              TEXT,
  tenant_id          UUID,
  tenant_name        TEXT,
  call_site          TEXT,
  platform_slug      TEXT,
  model_slug         TEXT,
  total_calls        BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_cost_usd     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('month', l.created_at), 'YYYY-MM') AS month,
    l.tenant_id,
    t.name        AS tenant_name,
    l.call_site,
    l.platform_slug,
    l.model_slug,
    COUNT(*)::BIGINT                 AS total_calls,
    COALESCE(SUM(l.tokens_input), 0)::BIGINT  AS total_tokens_input,
    COALESCE(SUM(l.tokens_output), 0)::BIGINT AS total_tokens_output,
    COALESCE(SUM(l.cost_total_usd), 0)        AS total_cost_usd
  FROM ai_usage_log l
  JOIN tenants t ON t.id = l.tenant_id
  WHERE l.created_at >= date_trunc('month', now()) - (p_months || ' months')::INTERVAL
    AND (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
  GROUP BY 1, 2, 3, 4, 5, 6
  ORDER BY 1 DESC, total_cost_usd DESC;
END;
$$;
