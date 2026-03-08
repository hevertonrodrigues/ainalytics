-- Migration: 20260308160000_add_deep_analyze_to_geo_analyses.sql
-- Description: Adds deep-analyze result columns to geo_analyses for merged scoring

ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_analyze_id UUID REFERENCES company_ai_analyses(id);
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_analyze_score NUMERIC(5,1);
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_generic_score NUMERIC(5,1);
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_specific_score NUMERIC(5,1);
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_metric_scores JSONB;
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_improvements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_prompts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_analyzed_pages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_reasoning JSONB;
ALTER TABLE geo_analyses ADD COLUMN IF NOT EXISTS deep_confidence INTEGER;
