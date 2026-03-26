-- ============================================================
-- Phase 1: Replace admin DB functions with views
-- Strategy: create views FIRST (additive), then edge functions
--           switch to them, then drop old functions.
-- ============================================================

-- ── AI COSTS VIEWS ──────────────────────────────────────────

-- 1a. AI costs by model
CREATE OR REPLACE VIEW admin_ai_costs_by_model AS
SELECT
  platform_slug,
  model_slug,
  COUNT(*)::int                            AS total_requests,
  COALESCE(SUM(tokens_input), 0)::bigint   AS total_tokens_input,
  COALESCE(SUM(tokens_output), 0)::bigint  AS total_tokens_output,
  ROUND(COALESCE(SUM(cost_total_usd), 0)::numeric, 6)  AS total_cost_usd,
  ROUND(COALESCE(SUM(cost_input_usd), 0)::numeric, 6)  AS cost_input_usd,
  ROUND(COALESCE(SUM(cost_output_usd), 0)::numeric, 6) AS cost_output_usd,
  ROUND(AVG(latency_ms))::int              AS avg_latency_ms,
  created_at::date                         AS log_date
FROM ai_usage_log
GROUP BY platform_slug, model_slug, created_at::date;

-- 1b. AI costs by call site
CREATE OR REPLACE VIEW admin_ai_costs_by_callsite AS
SELECT
  call_site,
  COUNT(*)::int                            AS total_requests,
  COUNT(*) FILTER (WHERE error IS NOT NULL)::int AS total_errors,
  COALESCE(SUM(tokens_input), 0)::bigint   AS total_tokens_input,
  COALESCE(SUM(tokens_output), 0)::bigint  AS total_tokens_output,
  ROUND(COALESCE(SUM(cost_total_usd), 0)::numeric, 6) AS total_cost_usd,
  ROUND(AVG(latency_ms))::int              AS avg_latency_ms,
  created_at::date                         AS log_date
FROM ai_usage_log
GROUP BY call_site, created_at::date;

-- 1c. AI costs by tenant
CREATE OR REPLACE VIEW admin_ai_costs_by_tenant AS
SELECT
  a.tenant_id,
  t.name                                   AS tenant_name,
  COUNT(*)::int                            AS total_requests,
  COALESCE(SUM(a.tokens_input), 0)::bigint AS total_tokens_input,
  COALESCE(SUM(a.tokens_output), 0)::bigint AS total_tokens_output,
  ROUND(COALESCE(SUM(a.cost_total_usd), 0)::numeric, 6) AS total_cost_usd,
  MIN(a.created_at)                        AS first_request,
  MAX(a.created_at)                        AS last_request,
  a.created_at::date                       AS log_date
FROM ai_usage_log a
LEFT JOIN tenants t ON t.id = a.tenant_id
GROUP BY a.tenant_id, t.name, a.created_at::date;

-- ── ADMIN ACTIVE USERS VIEW ────────────────────────────────

CREATE OR REPLACE VIEW admin_active_users AS
SELECT
  p.user_id,
  p.full_name,
  p.email,
  p.avatar_url,
  p.created_at,
  tu.tenant_id,
  t.name        AS tenant_name,
  t.slug        AS tenant_slug,
  pl.name       AS plan_name,
  s.current_period_end AS plan_end_date,
  s.status      AS subscription_status,
  -- Company
  COALESCE(cs.companies_count, 0) > 0      AS has_company,
  cs.first_company_name                    AS company_name,
  cs.first_company_domain                  AS company_domain,
  COALESCE(cs.companies_count, 0)::int     AS companies_count,
  -- Analysis
  COALESCE(ga.completed_analyses, 0) > 0   AS has_analysis,
  COALESCE(ga.total_analyses, 0)::int      AS total_analyses,
  COALESCE(ga.completed_analyses, 0)::int  AS completed_analyses,
  ga.best_geo_score,
  ga.latest_analysis_status,
  ga.latest_analysis_at,
  -- Prompts
  COALESCE(pr.active_prompts, 0) > 0       AS has_prompts,
  COALESCE(pr.total_prompts, 0)::int       AS total_prompts,
  COALESCE(pr.active_prompts, 0)::int      AS active_prompts,
  -- Answers
  COALESCE(pa.total_answers, 0) > 0        AS has_answers,
  COALESCE(pa.total_answers, 0)::int       AS total_answers,
  -- Active Models
  COALESCE(am.models_count, 0)::int        AS active_models_count,
  COALESCE(am.models_list, '[]'::jsonb)    AS active_models,
  -- Progress
  (
    (CASE WHEN COALESCE(cs.companies_count, 0) > 0 THEN 25 ELSE 0 END) +
    (CASE WHEN COALESCE(ga.completed_analyses, 0) > 0 THEN 25 ELSE 0 END) +
    (CASE WHEN COALESCE(pr.active_prompts, 0) > 0 THEN 25 ELSE 0 END) +
    (CASE WHEN COALESCE(pa.total_answers, 0) > 0 THEN 25 ELSE 0 END)
  ) AS progress_percent
FROM profiles p
INNER JOIN tenant_users tu
  ON tu.user_id = p.user_id AND tu.is_active = true
INNER JOIN tenants t
  ON t.id = tu.tenant_id
INNER JOIN subscriptions s
  ON s.tenant_id = tu.tenant_id
  AND s.status IN ('active', 'trialing')
LEFT JOIN plans pl
  ON pl.id = s.plan_id
-- Companies aggregate
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS companies_count,
    MIN(c.company_name) AS first_company_name,
    MIN(c.domain) AS first_company_domain
  FROM companies c
  WHERE c.tenant_id = tu.tenant_id
) cs ON true
-- Geo analyses aggregate
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total_analyses,
    COUNT(*) FILTER (WHERE ga2.status = 'completed')::int AS completed_analyses,
    MAX(ga2.geo_score) FILTER (WHERE ga2.status = 'completed') AS best_geo_score,
    (SELECT ga3.status FROM geo_analyses ga3
     JOIN companies c3 ON c3.id = ga3.company_id AND c3.tenant_id = tu.tenant_id
     ORDER BY ga3.created_at DESC LIMIT 1) AS latest_analysis_status,
    (SELECT ga3.created_at FROM geo_analyses ga3
     JOIN companies c3 ON c3.id = ga3.company_id AND c3.tenant_id = tu.tenant_id
     ORDER BY ga3.created_at DESC LIMIT 1) AS latest_analysis_at
  FROM geo_analyses ga2
  JOIN companies c2 ON c2.id = ga2.company_id AND c2.tenant_id = tu.tenant_id
) ga ON true
-- Prompts aggregate
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS total_prompts,
    COUNT(*) FILTER (WHERE pr2.is_active)::int AS active_prompts
  FROM prompts pr2
  WHERE pr2.tenant_id = tu.tenant_id
) pr ON true
-- Answers aggregate
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS total_answers
  FROM prompt_answers pa2
  WHERE pa2.tenant_id = tu.tenant_id
    AND pa2.deleted = false
) pa ON true
-- Active models
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS models_count,
    jsonb_agg(
      jsonb_build_object(
        'model_slug', m.slug,
        'model_name', m.name,
        'platform_slug', plat.slug,
        'platform_name', plat.name,
        'web_search_active', m.web_search_active
      ) ORDER BY plat.name, m.slug
    ) AS models_list
  FROM tenant_platform_models tpm
  JOIN models m ON m.id = tpm.model_id
  JOIN platforms plat ON plat.id = tpm.platform_id
  WHERE tpm.tenant_id = tu.tenant_id
    AND tpm.is_active = true
) am ON true;

-- ── ADMIN TIMELINE VIEW ────────────────────────────────────

-- Timeline answers view (replaces get_admin_timeline_answers)
CREATE OR REPLACE VIEW admin_timeline_answers AS
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
WHERE pa.deleted = false;
