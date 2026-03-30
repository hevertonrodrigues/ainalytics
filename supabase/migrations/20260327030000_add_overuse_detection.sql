-- ============================================================
-- Migration: Add overuse detection to admin_active_users view
-- ============================================================

DROP VIEW IF EXISTS admin_active_users;
CREATE VIEW admin_active_users AS
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
  -- Classification fields
  CASE
    WHEN s.status = 'active' AND COALESCE(pl.price, 0) > 0
      AND (s.stripe_subscription_id IS NOT NULL OR ap.id IS NOT NULL)
    THEN 'paid'
    WHEN s.status = 'trialing'
    THEN 'trial'
    ELSE 'free'
  END AS user_classification,
  (s.status = 'active'
    AND COALESCE(pl.price, 0) > 0
    AND (s.stripe_subscription_id IS NOT NULL OR ap.id IS NOT NULL))
    AS is_paid_user,
  -- ★ NEW: Plan limits from subscription
  s.max_prompts,
  s.max_models,
  -- ★ NEW: Over-limit detection
  (
    (s.max_prompts IS NOT NULL AND COALESCE(pr.active_prompts, 0) > s.max_prompts)
    OR
    (s.max_models IS NOT NULL AND COALESCE(am.models_count, 0) > s.max_models)
  ) AS is_over_limit,
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
LEFT JOIN subscriptions s
  ON s.tenant_id = tu.tenant_id
  AND s.status IN ('active', 'trialing')
LEFT JOIN plans pl
  ON pl.id = s.plan_id
LEFT JOIN LATERAL (
  SELECT ap2.id, ap2.code, ap2.plan_id
  FROM activation_plans ap2
  WHERE ap2.tenant_id = tu.tenant_id
    AND ap2.is_active = true
  LIMIT 1
) ap ON true
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
