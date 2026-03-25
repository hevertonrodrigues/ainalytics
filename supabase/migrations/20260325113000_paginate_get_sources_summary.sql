-- ============================================================
-- Migration: Paginate get_sources_summary
-- Replaces the existing function with a version that supports
-- pagination, search, and returns metadata in the first row.
-- ============================================================

-- Drop old single-param version
DROP FUNCTION IF EXISTS public.get_sources_summary(uuid);

-- Create paginated version
CREATE OR REPLACE FUNCTION public.get_sources_summary(
  p_tenant_id  uuid,
  p_page       int  DEFAULT 1,
  p_per_page   int  DEFAULT 50,
  p_search     text DEFAULT NULL
)
RETURNS TABLE (
  tenant_id        uuid,
  id               uuid,
  domain           text,
  total            integer,
  total_by_prompt  jsonb,
  total_by_answer  jsonb,
  total_by_platform jsonb,
  total_by_model   jsonb,
  -- pagination metadata
  meta_total_count    integer,
  meta_total_answers  integer,
  meta_total_prompts  integer,
  meta_total_platforms integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_offset          int := (GREATEST(p_page, 1) - 1) * p_per_page;
  v_total_count     int;
  v_total_answers   int;
  v_total_prompts   int;
  v_total_platforms  int;
BEGIN
  -- ── 1. Compute tenant-wide totals (lightweight counts) ────

  SELECT COUNT(*)::int INTO v_total_answers
  FROM prompt_answers pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.deleted = false;

  SELECT COUNT(*)::int INTO v_total_prompts
  FROM prompts p
  WHERE p.tenant_id = p_tenant_id
    AND p.is_active = true;

  SELECT COUNT(DISTINCT tpm.platform_id)::int INTO v_total_platforms
  FROM tenant_platform_models tpm
  WHERE tpm.tenant_id = p_tenant_id
    AND tpm.is_active = true;

  -- ── 2. Count matching sources (for pagination) ────────────

  SELECT COUNT(*)::int INTO v_total_count
  FROM sources s
  WHERE s.tenant_id = p_tenant_id
    AND EXISTS (
      SELECT 1
      FROM prompt_answer_sources pas
      JOIN prompt_answers pa ON pa.id = pas.answer_id AND pa.deleted = false
      WHERE pas.tenant_id = p_tenant_id
        AND pas.source_id = s.id
    )
    AND (p_search IS NULL OR s.domain ILIKE '%' || p_search || '%');

  -- ── 3. Return paginated results ───────────────────────────

  RETURN QUERY
  WITH tenant_pas AS (
    SELECT
      pas.tenant_id  AS t_id,
      pas.prompt_id,
      pas.answer_id,
      pas.source_id,
      pr.text        AS prompt_text,
      pa.platform_id,
      pa.platform_slug,
      pa.model_id,
      pl.name        AS platform_name,
      mo.name        AS model_name,
      mo.slug        AS model_slug
    FROM prompt_answer_sources pas
    JOIN prompt_answers pa
      ON pa.id = pas.answer_id
     AND pa.deleted = false
    LEFT JOIN prompts pr
      ON pr.id = pas.prompt_id
    LEFT JOIN platforms pl
      ON pl.id = pa.platform_id
    LEFT JOIN models mo
      ON mo.id = pa.model_id
    WHERE pas.tenant_id = p_tenant_id
  ),
  -- Get paginated source IDs (sorted by mention count desc)
  paginated_sources AS (
    SELECT
      s.id   AS source_id,
      s.tenant_id,
      s.domain,
      COALESCE(cnt.total, 0) AS src_total
    FROM sources s
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM tenant_pas tp
      WHERE tp.source_id = s.id
    ) cnt ON true
    WHERE s.tenant_id = p_tenant_id
      AND EXISTS (
        SELECT 1 FROM tenant_pas tp WHERE tp.source_id = s.id
      )
      AND (p_search IS NULL OR s.domain ILIKE '%' || p_search || '%')
    ORDER BY cnt.total DESC, s.domain ASC
    LIMIT p_per_page
    OFFSET v_offset
  )
  SELECT
    ps.tenant_id,
    ps.source_id        AS id,
    ps.domain,
    ps.src_total        AS total,
    COALESCE(by_prompt.total_by_prompt,     '[]'::jsonb) AS total_by_prompt,
    COALESCE(by_answer.total_by_answer,     '[]'::jsonb) AS total_by_answer,
    COALESCE(by_platform.total_by_platform, '[]'::jsonb) AS total_by_platform,
    COALESCE(by_model.total_by_model,       '[]'::jsonb) AS total_by_model,
    v_total_count,
    v_total_answers,
    v_total_prompts,
    v_total_platforms
  FROM paginated_sources ps
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'prompt_id',   sub.prompt_id,
        'prompt_text', sub.prompt_text,
        'count',       sub.cnt
      )
    ) AS total_by_prompt
    FROM (
      SELECT tp.prompt_id, tp.prompt_text, COUNT(*)::int AS cnt
      FROM tenant_pas tp
      WHERE tp.source_id = ps.source_id
      GROUP BY tp.prompt_id, tp.prompt_text
    ) sub
  ) by_prompt ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'answer_id', sub.answer_id,
        'count',     sub.cnt
      )
    ) AS total_by_answer
    FROM (
      SELECT tp.answer_id, COUNT(*)::int AS cnt
      FROM tenant_pas tp
      WHERE tp.source_id = ps.source_id
      GROUP BY tp.answer_id
    ) sub
  ) by_answer ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'platform_id',   sub.platform_id,
        'platform_name', sub.platform_name,
        'platform_slug', sub.platform_slug,
        'count',         sub.cnt
      )
    ) AS total_by_platform
    FROM (
      SELECT
        tp.platform_id,
        MAX(tp.platform_name) AS platform_name,
        tp.platform_slug,
        COUNT(*)::int AS cnt
      FROM tenant_pas tp
      WHERE tp.source_id = ps.source_id
      GROUP BY tp.platform_id, tp.platform_slug
    ) sub
  ) by_platform ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'model_id',   sub.model_id,
        'model_name', sub.model_name,
        'model_slug', sub.model_slug,
        'count',      sub.cnt
      )
    ) AS total_by_model
    FROM (
      SELECT
        tp.model_id,
        MAX(tp.model_name) AS model_name,
        MAX(tp.model_slug) AS model_slug,
        COUNT(*)::int AS cnt
      FROM tenant_pas tp
      WHERE tp.source_id = ps.source_id
      GROUP BY tp.model_id
    ) sub
  ) by_model ON true
  ORDER BY ps.src_total DESC, ps.domain ASC;
END;
$$;

-- ── Permissions ─────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_sources_summary(uuid, int, int, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sources_summary(uuid, int, int, text)
  TO service_role;
