-- ═══════════════════════════════════════════════════════════
-- RPC functions for AI costs dashboard
-- Aggregation happens in SQL to bypass Supabase 1000-row limit
-- ═══════════════════════════════════════════════════════════

-- 1. Summary KPIs
CREATE OR REPLACE FUNCTION get_ai_costs_summary(since_date timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'total_requests',       count(*),
    'total_tenants',        count(DISTINCT tenant_id),
    'total_models_used',    count(DISTINCT model_slug),
    'total_tokens_input',   coalesce(sum(tokens_input), 0),
    'total_tokens_output',  coalesce(sum(tokens_output), 0),
    'total_tokens',         coalesce(sum(tokens_input + tokens_output), 0),
    'total_cost_usd',       round(coalesce(sum(cost_total_usd), 0)::numeric, 6),
    'cost_input_usd',       round(coalesce(sum(cost_input_usd), 0)::numeric, 6),
    'cost_output_usd',      round(coalesce(sum(cost_output_usd), 0)::numeric, 6),
    'avg_latency_ms',       round(avg(latency_ms)),
    'error_count',          count(*) FILTER (WHERE error IS NOT NULL),
    'error_rate',           round(
      (count(*) FILTER (WHERE error IS NOT NULL))::numeric
      / GREATEST(count(*), 1) * 100, 2
    ),
    'avg_cost_per_request', round(
      coalesce(sum(cost_total_usd), 0)::numeric / GREATEST(count(*), 1), 6
    )
  )
  FROM ai_usage_log
  WHERE created_at >= since_date;
$$;

-- 2. By Tenant
CREATE OR REPLACE FUNCTION get_ai_costs_by_tenant(since_date timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(row_data ORDER BY total_cost DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'tenant_id',          a.tenant_id,
      'tenant_name',        coalesce(t.name, 'Unknown'),
      'total_requests',     count(*),
      'total_tokens_input', coalesce(sum(a.tokens_input), 0),
      'total_tokens_output',coalesce(sum(a.tokens_output), 0),
      'total_cost_usd',     round(coalesce(sum(a.cost_total_usd), 0)::numeric, 6),
      'models_used',        jsonb_agg(DISTINCT a.model_slug),
      'call_sites',         jsonb_agg(DISTINCT a.call_site),
      'first_request',      min(a.created_at),
      'last_request',       max(a.created_at)
    ) AS row_data,
    coalesce(sum(a.cost_total_usd), 0) AS total_cost
    FROM ai_usage_log a
    LEFT JOIN tenants t ON t.id = a.tenant_id
    WHERE a.created_at >= since_date
    GROUP BY a.tenant_id, t.name
  ) sub;
$$;

-- 3. By Model
CREATE OR REPLACE FUNCTION get_ai_costs_by_model(since_date timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(row_data ORDER BY total_cost DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'platform_slug',      platform_slug,
      'model_slug',         model_slug,
      'total_requests',     count(*),
      'total_tokens_input', coalesce(sum(tokens_input), 0),
      'total_tokens_output',coalesce(sum(tokens_output), 0),
      'total_cost_usd',     round(coalesce(sum(cost_total_usd), 0)::numeric, 6),
      'cost_input_usd',     round(coalesce(sum(cost_input_usd), 0)::numeric, 6),
      'cost_output_usd',    round(coalesce(sum(cost_output_usd), 0)::numeric, 6),
      'avg_latency_ms',     round(avg(latency_ms))
    ) AS row_data,
    coalesce(sum(cost_total_usd), 0) AS total_cost
    FROM ai_usage_log
    WHERE created_at >= since_date
    GROUP BY platform_slug, model_slug
  ) sub;
$$;

-- 4. By Call Site
CREATE OR REPLACE FUNCTION get_ai_costs_by_callsite(since_date timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(row_data ORDER BY total_cost DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'call_site',          call_site,
      'total_requests',     count(*),
      'total_errors',       count(*) FILTER (WHERE error IS NOT NULL),
      'error_rate',         round(
        (count(*) FILTER (WHERE error IS NOT NULL))::numeric
        / GREATEST(count(*), 1) * 100, 2
      ),
      'total_tokens_input', coalesce(sum(tokens_input), 0),
      'total_tokens_output',coalesce(sum(tokens_output), 0),
      'total_cost_usd',     round(coalesce(sum(cost_total_usd), 0)::numeric, 6),
      'avg_latency_ms',     round(avg(latency_ms)),
      'models_used',        jsonb_agg(DISTINCT model_slug)
    ) AS row_data,
    coalesce(sum(cost_total_usd), 0) AS total_cost
    FROM ai_usage_log
    WHERE created_at >= since_date
    GROUP BY call_site
  ) sub;
$$;

-- 5. Daily Breakdown (with platform sub-aggregation)
CREATE OR REPLACE FUNCTION get_ai_costs_daily(since_date timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH daily_platform AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS day,
      platform_slug,
      count(*)                              AS req_count,
      coalesce(sum(cost_total_usd), 0)      AS platform_cost,
      coalesce(sum(tokens_input + tokens_output), 0) AS platform_tokens
    FROM ai_usage_log
    WHERE created_at >= since_date
    GROUP BY 1, 2
  ),
  daily_agg AS (
    SELECT
      day,
      sum(req_count)::bigint                        AS total_requests,
      round(sum(platform_cost)::numeric, 6)         AS total_cost_usd,
      sum(platform_tokens)::bigint                  AS total_tokens,
      jsonb_object_agg(platform_slug, round(platform_cost::numeric, 6)) AS by_platform
    FROM daily_platform
    GROUP BY day
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date',           day::text,
        'total_requests', total_requests,
        'total_cost_usd', total_cost_usd,
        'total_tokens',   total_tokens,
        'by_platform',    by_platform
      ) ORDER BY day
    ),
    '[]'::jsonb
  )
  FROM daily_agg;
$$;
