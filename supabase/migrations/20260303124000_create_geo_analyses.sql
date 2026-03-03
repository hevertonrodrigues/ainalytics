-- Migration: 20260303124000_create_geo_analyses.sql
-- Description: Creates geo_analyses table for historical analysis tracking.
--              Moves analysis-specific data out of companies table.

-- ─── 1. Create geo_analyses table ──────────────────────────────

CREATE TABLE geo_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','scraping','scraping_done','analyzing','completed','error')),
  progress        INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  status_message  TEXT,

  -- Crawl data
  robots_txt      TEXT,
  sitemap_xml     TEXT,
  llms_txt        TEXT,
  crawled_pages   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- AI Analysis Report (bilingual)
  ai_report       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Denormalized scores for quick queries
  geo_score       DECIMAL(5,2),
  readiness_level INTEGER CHECK (readiness_level BETWEEN 0 AND 5),
  pages_crawled   INTEGER DEFAULT 0,
  total_pages     INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_geo_analyses_company ON geo_analyses(company_id);
CREATE INDEX idx_geo_analyses_company_created ON geo_analyses(company_id, created_at DESC);
CREATE INDEX idx_geo_analyses_status ON geo_analyses(status);

-- RLS
ALTER TABLE geo_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_analyses_select" ON geo_analyses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_companies tc
      JOIN tenant_users tu ON tu.tenant_id = tc.tenant_id
      WHERE tc.company_id = geo_analyses.company_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- ─── 2. Migrate existing analysis data from companies to geo_analyses ──

INSERT INTO geo_analyses (company_id, status, progress, error_message, robots_txt, sitemap_xml, crawled_pages, ai_report, pages_crawled, geo_score, completed_at)
SELECT
  c.id,
  c.status,
  c.progress,
  c.error_message,
  c.robots_txt,
  c.sitemap_xml,
  c.pages,
  c.ai_report,
  jsonb_array_length(c.pages),
  -- Extract geo_score from ai_report (check en first, then pt)
  COALESCE(
    (c.ai_report->'en'->>'composite_score')::DECIMAL(5,2),
    (c.ai_report->'pt'->>'composite_score')::DECIMAL(5,2),
    NULL
  ),
  CASE WHEN c.status = 'completed' THEN c.updated_at ELSE NULL END
FROM companies c
WHERE c.status != 'pending' OR jsonb_array_length(c.pages) > 0;

-- ─── 3. Drop analysis columns from companies ──────────────────

ALTER TABLE companies DROP COLUMN IF EXISTS pages;
ALTER TABLE companies DROP COLUMN IF EXISTS seo_issues;
ALTER TABLE companies DROP COLUMN IF EXISTS ai_report;
ALTER TABLE companies DROP COLUMN IF EXISTS robots_txt;
ALTER TABLE companies DROP COLUMN IF EXISTS sitemap_xml;
ALTER TABLE companies DROP COLUMN IF EXISTS status;
ALTER TABLE companies DROP COLUMN IF EXISTS progress;
ALTER TABLE companies DROP COLUMN IF EXISTS error_message;
