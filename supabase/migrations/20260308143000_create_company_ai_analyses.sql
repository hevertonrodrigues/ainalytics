-- Create table: company_ai_analyses
-- Stores Deep Analyze results from ChatGPT analysis of any company URL
CREATE TABLE IF NOT EXISTS company_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Input
  url TEXT NOT NULL,
  company_name TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),
  error_message TEXT,

  -- Analysis scope (pages used by the AI)
  analysis_scope JSONB,

  -- Computed scores (0–100, 1 decimal)
  final_score NUMERIC(5,1),
  generic_score NUMERIC(5,1),
  specific_score NUMERIC(5,1),

  -- Individual metric scores (0–5)
  semantic_score NUMERIC(3,1),
  content_score NUMERIC(3,1),
  authority_score NUMERIC(3,1),
  technical_score NUMERIC(3,1),
  competitive_position_score NUMERIC(3,1),

  -- Reasoning (JSONB object with summary + per-metric reasoning)
  reasoning JSONB,

  -- Arrays stored as JSONB
  high_probability_prompts JSONB DEFAULT '[]'::jsonb,
  improvements JSONB DEFAULT '[]'::jsonb,

  -- Confidence (0–100)
  confidence INTEGER,

  -- Full raw response for debugging
  raw_response JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on tenant_id (REQUIRED for every table)
CREATE INDEX IF NOT EXISTS idx_company_ai_analyses_tenant_id
  ON company_ai_analyses(tenant_id);

-- Index for ordering by creation date per tenant
CREATE INDEX IF NOT EXISTS idx_company_ai_analyses_tenant_created
  ON company_ai_analyses(tenant_id, created_at DESC);

-- Enable RLS (REQUIRED for every table)
ALTER TABLE company_ai_analyses ENABLE ROW LEVEL SECURITY;

-- SELECT policy: authenticated users in same tenant
CREATE POLICY "company_ai_analyses_select_own_tenant"
  ON company_ai_analyses FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- No INSERT/UPDATE/DELETE policies for 'authenticated'
-- Mutations happen via Edge Functions using service_role

-- Updated_at trigger
CREATE TRIGGER set_company_ai_analyses_updated_at
  BEFORE UPDATE ON company_ai_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
