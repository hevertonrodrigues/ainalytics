-- ============================================================
-- SQL RPC functions for SA Monitoring Timeline
-- Requires service_role (Edge Functions) — no RLS concern
-- ============================================================

-- 1) Grouped aggregation by time bucket
CREATE OR REPLACE FUNCTION get_admin_timeline_grouped(
  since_date TIMESTAMPTZ,
  group_by TEXT DEFAULT 'day',
  tenant_filter UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bucket TEXT;
  result JSONB;
BEGIN
  CASE group_by
    WHEN 'hour'  THEN bucket := 'hour';
    WHEN 'week'  THEN bucket := 'week';
    WHEN 'month' THEN bucket := 'month';
    ELSE bucket := 'day';
  END CASE;

  WITH base AS (
    SELECT
      date_trunc(bucket, pa.searched_at) AS period,
      pa.platform_slug,
      pa.error,
      pa.latency_ms,
      pa.tenant_id
    FROM prompt_answers pa
    WHERE pa.searched_at >= since_date
      AND pa.deleted = false
      AND (tenant_filter IS NULL OR pa.tenant_id = tenant_filter)
  ),
  platform_counts AS (
    SELECT period, platform_slug, COUNT(*)::INT AS cnt
    FROM base
    GROUP BY period, platform_slug
  ),
  platform_agg AS (
    SELECT period, jsonb_object_agg(platform_slug, cnt) AS platforms
    FROM platform_counts
    GROUP BY period
  )
  SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.period DESC)
  INTO result
  FROM (
    SELECT
      b.period,
      COUNT(*)::INT AS total_answers,
      COUNT(*) FILTER (WHERE b.error IS NULL)::INT AS success_count,
      COUNT(*) FILTER (WHERE b.error IS NOT NULL)::INT AS error_count,
      ROUND(AVG(b.latency_ms))::INT AS avg_latency_ms,
      COUNT(DISTINCT b.tenant_id)::INT AS tenant_count,
      COALESCE(pa.platforms, '{}'::jsonb) AS platforms
    FROM base b
    LEFT JOIN platform_agg pa ON pa.period = b.period
    GROUP BY b.period, pa.platforms
  ) r;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 2) Paginated individual answers with joins (uses model_id FK)
CREATE OR REPLACE FUNCTION get_admin_timeline_answers(
  since_date TIMESTAMPTZ,
  tenant_filter UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  items JSONB;
  total_count INT;
BEGIN
  SELECT COUNT(*)
  INTO total_count
  FROM prompt_answers pa
  WHERE pa.searched_at >= since_date
    AND pa.deleted = false
    AND (tenant_filter IS NULL OR pa.tenant_id = tenant_filter);

  SELECT jsonb_agg(row_to_json(r)::jsonb)
  INTO items
  FROM (
    SELECT
      pa.id,
      pa.tenant_id,
      t.name AS tenant_name,
      pa.prompt_id,
      LEFT(p.text, 120) AS prompt_text,
      tp.name AS topic_name,
      pa.platform_slug,
      pa.model_id,
      m.name AS model_name,
      m.slug AS model_slug,
      pa.answer_text IS NOT NULL AS has_answer,
      LEFT(pa.answer_text, 200) AS answer_preview,
      pa.tokens_used,
      pa.latency_ms,
      pa.error,
      pa.searched_at,
      pa.created_at
    FROM prompt_answers pa
    LEFT JOIN tenants t ON t.id = pa.tenant_id
    LEFT JOIN prompts p ON p.id = pa.prompt_id
    LEFT JOIN topics tp ON tp.id = p.topic_id
    LEFT JOIN models m ON m.id = pa.model_id
    WHERE pa.searched_at >= since_date
      AND pa.deleted = false
      AND (tenant_filter IS NULL OR pa.tenant_id = tenant_filter)
    ORDER BY pa.searched_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) r;

  RETURN jsonb_build_object(
    'items', COALESCE(items, '[]'::jsonb),
    'total', total_count,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- 3) Quick tenant list for filters
CREATE OR REPLACE FUNCTION get_admin_tenants_list()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.name)
  INTO result
  FROM (
    SELECT id, name FROM tenants WHERE name IS NOT NULL ORDER BY name
  ) r;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
