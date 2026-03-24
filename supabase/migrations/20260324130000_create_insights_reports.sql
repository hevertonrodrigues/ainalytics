-- Insights Reports: cached AI-generated insights per tenant
CREATE TABLE insights_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  overall_health text NOT NULL DEFAULT 'good',
  health_score int,
  summary text,
  checks jsonb DEFAULT '[]',
  action_items jsonb DEFAULT '[]',
  highlights jsonb DEFAULT '[]',
  raw_response jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE insights_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights_reports_tenant_isolation" ON insights_reports
  FOR ALL USING (tenant_id::text = coalesce(current_setting('app.tenant_id', true), ''));

CREATE INDEX idx_insights_reports_tenant ON insights_reports(tenant_id);
CREATE INDEX idx_insights_reports_tenant_created ON insights_reports(tenant_id, created_at DESC);
