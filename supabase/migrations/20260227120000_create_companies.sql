-- Migration: 20260227120000_create_companies.sql
-- Description: Creates the companies table to store scraped website/SEO data and AI analysis report.

CREATE TABLE companies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','scraping','scraping_done','analyzing','completed','error')),
  progress         INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,

  -- Basic website info (from scraping)
  website_title    TEXT,
  meta_description TEXT,
  meta_keywords    TEXT,
  og_image         TEXT,
  favicon_url      TEXT,
  language         TEXT,
  robots_txt       TEXT,
  sitemap_xml      TEXT,

  -- Scraped pages data (JSONB array)
  -- [{url, title, meta_description, h1, content_summary, word_count, has_structured_data, is_client_rendered, has_captcha, status_code, load_time_ms}]
  pages            JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- SEO Technical Issues (JSONB array)
  -- [{page_url, issue_type, severity, description}]
  seo_issues       JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- AI Analysis Report (JSONB object from Claude)
  -- {summary, tags[], categories[], market, country, products_services[],
  --  competitors[], strengths[], weaknesses[], seo_score, geo_score,
  --  recommendations[], content_quality, structured_data_coverage,
  --  ai_bot_access{}, schema_markup_types[]}
  ai_report        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Quick-access denormalized fields from ai_report
  company_name     TEXT,
  industry         TEXT,
  country          TEXT,
  tags             JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS enabled here; policy added in 20260227120100 after tenant_companies exists
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
