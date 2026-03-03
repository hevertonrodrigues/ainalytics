-- Migration: 20260227120200_rename_seo_to_geo.sql
-- Description: Renames seo_issues column to geo_issues and updates comments to reflect GEO-only focus.

ALTER TABLE companies RENAME COLUMN seo_issues TO geo_issues;

COMMENT ON TABLE companies IS 'Company website data and GEO (Generative Engine Optimization) analysis results';
COMMENT ON COLUMN companies.geo_issues IS 'GEO issues found during website analysis [{page_url, issue_type, severity, description}]';
COMMENT ON COLUMN companies.ai_report IS 'AI GEO analysis report from Claude {summary, geo_score, content_quality, ...}';
