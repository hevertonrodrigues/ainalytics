-- ============================================================
-- Migration: Create prompts_summary view
-- One row per prompt with aggregated JSONB counts from
-- prompt_answers (grouped by platform + model) and
-- prompt_answer_sources (grouped by source_id)
-- ============================================================

DROP VIEW IF EXISTS prompts_summary;
CREATE OR REPLACE VIEW prompts_summary AS
SELECT
  p.id,
  p.tenant_id,
  p.topic_id,
  p.text,
  p.description,
  p.is_active,
  p.created_at,
  p.updated_at,

  -- JSONB array: count of prompt_answers grouped by platform and model
  COALESCE(pa_agg.answers, '[]'::jsonb) AS answers,

  -- JSONB array: count of prompt_answer_sources grouped by source_id
  COALESCE(pas_agg.sources, '[]'::jsonb) AS sources

FROM prompts p

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'platform_id', sub.platform_id,
      'platform_slug', sub.platform_slug,
      'model_id', sub.model_id,
      'model_slug', sub.model_slug,
      'count', sub.cnt
    )
  ) AS answers
  FROM (
    SELECT
      pa.platform_id,
      pl.slug AS platform_slug,
      pa.model_id,
      m.slug  AS model_slug,
      COUNT(*)::int AS cnt
    FROM prompt_answers pa
    LEFT JOIN platforms pl ON pl.id = pa.platform_id
    LEFT JOIN models m ON m.id = pa.model_id
    WHERE pa.prompt_id = p.id
    GROUP BY pa.platform_id, pl.slug, pa.model_id, m.slug
  ) sub
) pa_agg ON true

LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'source_id', sub.source_id,
      'domain', sub.domain,
      'count', sub.cnt
    )
  ) AS sources
  FROM (
    SELECT
      pas.source_id,
      s.domain,
      COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    LEFT JOIN sources s ON s.id = pas.source_id
    WHERE pas.prompt_id = p.id
    GROUP BY pas.source_id, s.domain
  ) sub
) pas_agg ON true;

-- Make the view respect RLS policies of underlying tables
ALTER VIEW prompts_summary SET (security_invoker = true);

-- Restrict access to authenticated users only
REVOKE ALL ON prompts_summary FROM anon, public;
GRANT SELECT ON prompts_summary TO authenticated;
