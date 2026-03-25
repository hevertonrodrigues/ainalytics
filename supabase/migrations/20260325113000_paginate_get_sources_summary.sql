-- ============================================================
-- Migration: Replace DB functions with views for sources-summary
-- All business logic moves to the edge function.
-- Views provide the aggregation that PostgREST can't do.
-- ============================================================

-- ── 1. Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_prompt_answer_sources_tenant_source
  ON prompt_answer_sources(tenant_id, source_id);

CREATE INDEX IF NOT EXISTS idx_pas_tenant_source_answer
  ON prompt_answer_sources(tenant_id, source_id, answer_id);

-- ── 2. Drop old functions ───────────────────────────────────

DROP FUNCTION IF EXISTS public.get_sources_summary(uuid);
DROP FUNCTION IF EXISTS public.get_sources_summary(uuid, int, int, text);
DROP FUNCTION IF EXISTS public.get_source_breakdowns_by_prompt(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.get_source_breakdowns_by_platform(uuid, uuid[]);

-- ── 3. Views ────────────────────────────────────────────────

-- 3a. Count of distinct answers per source (for % calculation)
CREATE OR REPLACE VIEW source_mention_counts AS
SELECT
  pas.tenant_id,
  pas.source_id,
  COUNT(DISTINCT pas.answer_id)::int AS mention_count
FROM prompt_answer_sources pas
JOIN prompt_answers pa ON pa.id = pas.answer_id AND pa.deleted = false
GROUP BY pas.tenant_id, pas.source_id;

-- 3b. Prompt breakdown per source (for expanded detail)
CREATE OR REPLACE VIEW source_prompt_counts AS
SELECT
  pas.tenant_id,
  pas.source_id,
  pas.prompt_id,
  p.text AS prompt_text,
  COUNT(*)::int AS cnt
FROM prompt_answer_sources pas
JOIN prompt_answers pa ON pa.id = pas.answer_id AND pa.deleted = false
LEFT JOIN prompts p ON p.id = pas.prompt_id
GROUP BY pas.tenant_id, pas.source_id, pas.prompt_id, p.text;

-- 3c. Platform breakdown per source (for expanded detail)
CREATE OR REPLACE VIEW source_platform_counts AS
SELECT
  pas.tenant_id,
  pas.source_id,
  pa.platform_id,
  pl.name AS platform_name,
  pa.platform_slug,
  COUNT(*)::int AS cnt
FROM prompt_answer_sources pas
JOIN prompt_answers pa ON pa.id = pas.answer_id AND pa.deleted = false
LEFT JOIN platforms pl ON pl.id = pa.platform_id
GROUP BY pas.tenant_id, pas.source_id, pa.platform_id, pl.name, pa.platform_slug;

-- ── 4. Keep backward-compat function for other callers ──────

CREATE OR REPLACE FUNCTION public.get_sources_summary_full(p_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  id uuid,
  domain text,
  total integer,
  total_by_prompt jsonb,
  total_by_answer jsonb,
  total_by_platform jsonb,
  total_by_model jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH tenant_pas AS (
    SELECT
      pas.tenant_id, pas.prompt_id, pas.answer_id, pas.source_id,
      p.text AS prompt_text, pa.platform_id, pa.platform_slug,
      pa.model_id, pl.name AS platform_name, m.name AS model_name, m.slug AS model_slug
    FROM prompt_answer_sources pas
    JOIN prompt_answers pa ON pa.id = pas.answer_id AND pa.deleted = false
    LEFT JOIN prompts p ON p.id = pas.prompt_id
    LEFT JOIN platforms pl ON pl.id = pa.platform_id
    LEFT JOIN models m ON m.id = pa.model_id
    WHERE pas.tenant_id = p_tenant_id
  ),
  tenant_sources AS (
    SELECT DISTINCT source_id FROM tenant_pas
  )
  SELECT
    s.tenant_id, s.id, s.domain,
    COALESCE(total_agg.total, 0) AS total,
    COALESCE(by_prompt.total_by_prompt, '[]'::jsonb),
    COALESCE(by_answer.total_by_answer, '[]'::jsonb),
    COALESCE(by_platform.total_by_platform, '[]'::jsonb),
    COALESCE(by_model.total_by_model, '[]'::jsonb)
  FROM sources s
  JOIN tenant_sources ts ON ts.source_id = s.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total FROM tenant_pas pas WHERE pas.source_id = s.id
  ) total_agg ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('prompt_id', sub.prompt_id, 'prompt_text', sub.prompt_text, 'count', sub.cnt)) AS total_by_prompt
    FROM (SELECT pas.prompt_id, pas.prompt_text, COUNT(*)::int AS cnt FROM tenant_pas pas WHERE pas.source_id = s.id GROUP BY pas.prompt_id, pas.prompt_text) sub
  ) by_prompt ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('answer_id', sub.answer_id, 'count', sub.cnt)) AS total_by_answer
    FROM (SELECT pas.answer_id, COUNT(*)::int AS cnt FROM tenant_pas pas WHERE pas.source_id = s.id GROUP BY pas.answer_id) sub
  ) by_answer ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('platform_id', sub.platform_id, 'platform_name', sub.platform_name, 'platform_slug', sub.platform_slug, 'count', sub.cnt)) AS total_by_platform
    FROM (SELECT pas.platform_id, pl.name AS platform_name, pas.platform_slug, COUNT(*)::int AS cnt FROM tenant_pas pas LEFT JOIN platforms pl ON pl.id = pas.platform_id WHERE pas.source_id = s.id GROUP BY pas.platform_id, pl.name, pas.platform_slug) sub
  ) by_platform ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('model_id', sub.model_id, 'model_name', sub.model_name, 'model_slug', sub.model_slug, 'count', sub.cnt)) AS total_by_model
    FROM (SELECT pas.model_id, pas.model_name, pas.model_slug, COUNT(*)::int AS cnt FROM tenant_pas pas WHERE pas.source_id = s.id GROUP BY pas.model_id, pas.model_name, pas.model_slug) sub
  ) by_model ON true
  WHERE s.tenant_id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.get_sources_summary_full(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sources_summary_full(uuid)
  TO service_role;
