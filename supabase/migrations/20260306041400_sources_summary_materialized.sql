-- ============================================================
-- Migration: Convert sources_summary to materialized view
-- with triggers to refresh on data changes
-- ============================================================

-- Drop the regular view
DROP VIEW IF EXISTS sources_summary;

-- Create materialized view
CREATE MATERIALIZED VIEW sources_summary AS
SELECT
  s.tenant_id,
  s.id,
  s.domain,

  -- Total count of prompt_answer_sources referencing this source in this tenant
  COALESCE(total_agg.total, 0) AS total,

  -- JSONB array: count grouped by prompt_id
  COALESCE(by_prompt.total_by_prompt, '[]'::jsonb) AS total_by_prompt,

  -- JSONB array: count grouped by answer_id
  COALESCE(by_answer.total_by_answer, '[]'::jsonb) AS total_by_answer,

  -- JSONB array: count grouped by platform_id (from prompt_answers)
  COALESCE(by_platform.total_by_platform, '[]'::jsonb) AS total_by_platform,

  -- JSONB array: count grouped by model_id (from prompt_answers)
  COALESCE(by_model.total_by_model, '[]'::jsonb) AS total_by_model

FROM sources s

LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS total
  FROM prompt_answer_sources pas
  WHERE pas.source_id = s.id
    AND pas.tenant_id = s.tenant_id
) total_agg ON true

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'prompt_id', sub.prompt_id,
      'prompt_text', sub.prompt_text,
      'count', sub.cnt
    )
  ) AS total_by_prompt
  FROM (
    SELECT pas.prompt_id, p.text AS prompt_text, COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    JOIN prompts p ON p.id = pas.prompt_id
    WHERE pas.source_id = s.id
      AND pas.tenant_id = s.tenant_id
    GROUP BY pas.prompt_id, p.text
  ) sub
) by_prompt ON true

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'answer_id', sub.answer_id,
      'count', sub.cnt
    )
  ) AS total_by_answer
  FROM (
    SELECT pas.answer_id, COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    WHERE pas.source_id = s.id
      AND pas.tenant_id = s.tenant_id
    GROUP BY pas.answer_id
  ) sub
) by_answer ON true

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'platform_id', sub.platform_id,
      'platform_name', sub.platform_name,
      'platform_slug', sub.platform_slug,
      'count', sub.cnt
    )
  ) AS total_by_platform
  FROM (
    SELECT pa.platform_id, pl.name AS platform_name, pl.slug AS platform_slug, COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    JOIN prompt_answers pa ON pa.id = pas.answer_id
    JOIN platforms pl ON pl.id = pa.platform_id
    WHERE pas.source_id = s.id
      AND pas.tenant_id = s.tenant_id
    GROUP BY pa.platform_id, pl.name, pl.slug
  ) sub
) by_platform ON true

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'model_id', sub.model_id,
      'model_name', sub.model_name,
      'model_slug', sub.model_slug,
      'count', sub.cnt
    )
  ) AS total_by_model
  FROM (
    SELECT pa.model_id, m.name AS model_name, m.slug AS model_slug, COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    JOIN prompt_answers pa ON pa.id = pas.answer_id
    JOIN models m ON m.id = pa.model_id
    WHERE pas.source_id = s.id
      AND pas.tenant_id = s.tenant_id
    GROUP BY pa.model_id, m.name, m.slug
  ) sub
) by_model ON true;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_sources_summary_pk ON sources_summary (tenant_id, id);

-- ============================================================
-- Function to refresh the materialized view concurrently
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_sources_summary()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sources_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Triggers to refresh on changes to relevant tables
-- ============================================================

-- Refresh on INSERT/UPDATE/DELETE on sources
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_sources ON sources;
CREATE TRIGGER trg_refresh_sources_summary_on_sources
  AFTER INSERT OR UPDATE OR DELETE ON sources
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_sources_summary();

-- Refresh on INSERT/UPDATE/DELETE on prompt_answer_sources
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_pas ON prompt_answer_sources;
CREATE TRIGGER trg_refresh_sources_summary_on_pas
  AFTER INSERT OR UPDATE OR DELETE ON prompt_answer_sources
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_sources_summary();

-- Refresh on UPDATE/DELETE on prompt_answers (platform_id/model_id may change)
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_pa ON prompt_answers;
CREATE TRIGGER trg_refresh_sources_summary_on_pa
  AFTER UPDATE OR DELETE ON prompt_answers
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_sources_summary();

-- ============================================================
-- RLS: Materialized views don't support RLS directly.
-- Access is controlled via Edge Function with auth + tenant check.
-- ============================================================

-- No direct access to the materialized view
REVOKE ALL ON sources_summary FROM anon, public, authenticated;

-- ============================================================
-- RPC function for Edge Function to query sources_summary
-- Runs as SECURITY DEFINER to bypass REVOKE on the matview
-- ============================================================
CREATE OR REPLACE FUNCTION get_sources_summary(p_tenant_id UUID)
RETURNS SETOF sources_summary
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM sources_summary WHERE tenant_id = p_tenant_id;
$$;
