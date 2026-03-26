-- ============================================================
-- Migration: Metrics Pipeline — Views, Tables, Correct Classification
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Dashboard Access Log — track user page views
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_dashboard_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  referrer TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_tenant
  ON admin_dashboard_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_user
  ON admin_dashboard_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_created
  ON admin_dashboard_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_page
  ON admin_dashboard_access_log(page, created_at DESC);

ALTER TABLE admin_dashboard_access_log ENABLE ROW LEVEL SECURITY;
-- No policies — only service_role (edge functions) can write/read

-- ────────────────────────────────────────────────────────────
-- 2. admin_subscription_pipeline — correct user classification
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_subscription_pipeline AS
WITH latest_sub AS (
  -- Get the most recent subscription per tenant
  SELECT DISTINCT ON (s.tenant_id)
    s.*,
    p.name  AS plan_name,
    p.price AS plan_price
  FROM subscriptions s
  LEFT JOIN plans p ON p.id = s.plan_id
  ORDER BY s.tenant_id, s.created_at DESC
),
-- Check if tenant ever had an active paid subscription
ever_paid AS (
  SELECT DISTINCT s.tenant_id
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.status = 'active'
    AND p.price > 0
)
SELECT
  pr.user_id,
  pr.full_name,
  pr.email,
  pr.avatar_url,
  pr.created_at                              AS registered_at,
  tu.tenant_id,
  t.name                                     AS tenant_name,
  t.slug                                     AS tenant_slug,
  t.code                                     AS tenant_code,
  au.email_confirmed_at,
  au.last_sign_in_at,
  -- Subscription details
  ls.id                                      AS subscription_id,
  ls.status                                  AS subscription_status,
  ls.plan_name,
  ls.plan_price,
  ls.billing_interval,
  ls.paid_amount,
  ls.stripe_subscription_id,
  ls.stripe_customer_id,
  ls.current_period_start,
  ls.current_period_end,
  ls.canceled_at,
  ls.cancel_at_period_end,
  ls.created_at                              AS subscription_created_at,
  -- Activation code info
  ap.code                                    AS activation_code,
  ap.plan_id                                 AS activation_plan_id,
  -- Classification
  CASE
    -- PAID: active subscription, plan price > 0, with stripe OR activation code
    WHEN ls.status = 'active'
      AND COALESCE(ls.plan_price, 0) > 0
      AND (ls.stripe_subscription_id IS NOT NULL OR ap.id IS NOT NULL)
    THEN 'paid'
    -- TRIAL: trialing status (never paid)
    WHEN ls.status = 'trialing'
    THEN 'trial'
    -- CHURNED FROM PAID: was canceled but previously was a paid subscriber
    WHEN ls.status = 'canceled'
      AND ep.tenant_id IS NOT NULL
    THEN 'churned_paid'
    -- CHURNED FROM TRIAL: was canceled, was trialing, never paid
    WHEN ls.status = 'canceled'
      AND ep.tenant_id IS NULL
    THEN 'churned_trial'
    -- FREE: has subscription but plan is $0
    WHEN ls.id IS NOT NULL
      AND COALESCE(ls.plan_price, 0) = 0
      AND ls.status NOT IN ('canceled')
    THEN 'free'
    -- REGISTERED: no subscription at all
    ELSE 'registered'
  END AS user_classification,
  -- Pipeline stage (more granular)
  CASE
    WHEN ls.status = 'active'
      AND COALESCE(ls.plan_price, 0) > 0
      AND ls.stripe_subscription_id IS NOT NULL
    THEN 'paid_stripe'
    WHEN ls.status = 'active'
      AND COALESCE(ls.plan_price, 0) > 0
      AND ap.id IS NOT NULL
    THEN 'paid_activation'
    WHEN ls.status = 'trialing'
      AND ls.stripe_subscription_id IS NOT NULL
    THEN 'trial_stripe'
    WHEN ls.status = 'trialing'
      AND ap.id IS NOT NULL
    THEN 'trial_activation'
    WHEN ls.status = 'trialing'
    THEN 'trial_other'
    WHEN ls.status = 'canceled'
      AND ep.tenant_id IS NOT NULL
    THEN 'churned_from_paid'
    WHEN ls.status = 'canceled'
      AND ep.tenant_id IS NULL
    THEN 'churned_from_trial'
    WHEN ls.id IS NOT NULL
      AND COALESCE(ls.plan_price, 0) = 0
      AND ls.status NOT IN ('canceled')
    THEN 'free_user'
    WHEN au.email_confirmed_at IS NOT NULL
    THEN 'email_confirmed'
    ELSE 'registered'
  END AS pipeline_stage,
  -- Convenience booleans
  (ls.status = 'active' AND COALESCE(ls.plan_price, 0) > 0
   AND (ls.stripe_subscription_id IS NOT NULL OR ap.id IS NOT NULL))
    AS is_paid_user,
  (au.email_confirmed_at IS NOT NULL)
    AS is_email_confirmed,
  (ls.status = 'trialing')
    AS is_trialing,
  (ls.status = 'canceled')
    AS is_churned,
  -- Days metrics
  CASE WHEN ls.status = 'canceled' AND ls.canceled_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ls.canceled_at - ls.created_at)) / 86400
    ELSE NULL
  END::int AS days_before_churn,
  CASE WHEN ls.status = 'trialing'
    THEN EXTRACT(EPOCH FROM (COALESCE(ls.current_period_end, now()) - ls.created_at)) / 86400
    ELSE NULL
  END::int AS days_in_trial
FROM profiles pr
INNER JOIN tenant_users tu
  ON tu.user_id = pr.user_id AND tu.is_active = true
INNER JOIN tenants t
  ON t.id = tu.tenant_id
LEFT JOIN auth.users au
  ON au.id = pr.user_id
LEFT JOIN latest_sub ls
  ON ls.tenant_id = tu.tenant_id
LEFT JOIN ever_paid ep
  ON ep.tenant_id = tu.tenant_id
LEFT JOIN LATERAL (
  SELECT ap2.id, ap2.code, ap2.plan_id
  FROM activation_plans ap2
  WHERE ap2.tenant_id = tu.tenant_id
    AND ap2.is_active = true
  LIMIT 1
) ap ON true;


-- ────────────────────────────────────────────────────────────
-- 3. admin_conversion_metrics — funnel aggregation
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_conversion_metrics AS
WITH counts AS (
  SELECT
    COUNT(*)                                                              AS total_registered,
    COUNT(*) FILTER (WHERE is_email_confirmed)                            AS total_email_confirmed,
    COUNT(*) FILTER (WHERE is_trialing)                                   AS total_trialing,
    COUNT(*) FILTER (WHERE is_paid_user)                                  AS total_paid,
    COUNT(*) FILTER (WHERE user_classification = 'churned_trial')         AS total_churned_trial,
    COUNT(*) FILTER (WHERE user_classification = 'churned_paid')          AS total_churned_paid,
    COUNT(*) FILTER (WHERE user_classification = 'free')                  AS total_free,
    COUNT(*) FILTER (WHERE pipeline_stage = 'paid_stripe')                AS total_paid_stripe,
    COUNT(*) FILTER (WHERE pipeline_stage = 'paid_activation')            AS total_paid_activation,
    COUNT(*) FILTER (WHERE pipeline_stage = 'trial_stripe')               AS total_trial_stripe,
    COUNT(*) FILTER (WHERE pipeline_stage = 'trial_activation')           AS total_trial_activation
  FROM admin_subscription_pipeline
)
SELECT
  c.*,
  (c.total_churned_trial + c.total_churned_paid)                          AS total_churned,
  -- Conversion rates
  CASE WHEN c.total_registered > 0
    THEN ROUND(c.total_email_confirmed::numeric / c.total_registered * 100, 2)
    ELSE 0
  END AS registration_to_email_pct,
  CASE WHEN c.total_email_confirmed > 0
    THEN ROUND((c.total_trialing + c.total_paid + c.total_churned_trial + c.total_churned_paid)::numeric / c.total_email_confirmed * 100, 2)
    ELSE 0
  END AS email_to_trial_or_paid_pct,
  CASE WHEN (c.total_trialing + c.total_paid + c.total_churned_trial + c.total_churned_paid) > 0
    THEN ROUND((c.total_paid + c.total_churned_paid)::numeric / (c.total_trialing + c.total_paid + c.total_churned_trial + c.total_churned_paid) * 100, 2)
    ELSE 0
  END AS trial_to_paid_pct,
  -- Churn rates
  CASE WHEN (c.total_paid + c.total_churned_paid) > 0
    THEN ROUND(c.total_churned_paid::numeric / (c.total_paid + c.total_churned_paid) * 100, 2)
    ELSE 0
  END AS paid_churn_rate_pct,
  CASE WHEN (c.total_trialing + c.total_churned_trial) > 0
    THEN ROUND(c.total_churned_trial::numeric / (c.total_trialing + c.total_churned_trial) * 100, 2)
    ELSE 0
  END AS trial_churn_rate_pct
FROM counts c;


-- ────────────────────────────────────────────────────────────
-- 4. admin_revenue_metrics — MRR/ARR/ARPU (paid-only)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_revenue_metrics AS
WITH paid_subs AS (
  -- ONLY truly paid active subscriptions
  SELECT
    s.tenant_id,
    s.billing_interval,
    s.paid_amount,
    s.currency,
    s.stripe_subscription_id,
    s.created_at,
    p.name AS plan_name,
    p.price AS plan_price,
    CASE
      WHEN s.billing_interval = 'monthly' THEN s.paid_amount
      WHEN s.billing_interval = 'yearly'  THEN s.paid_amount / 12
      ELSE s.paid_amount
    END AS mrr_contribution
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.status = 'active'
    AND p.price > 0
)
SELECT
  COUNT(*)::int                                           AS total_paid_subscribers,
  COALESCE(SUM(mrr_contribution), 0)::numeric            AS mrr,
  COALESCE(SUM(mrr_contribution) * 12, 0)::numeric       AS arr,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(SUM(mrr_contribution) / COUNT(*), 2)
    ELSE 0
  END::numeric                                            AS arpu_monthly,
  COALESCE(SUM(paid_amount), 0)::numeric                  AS total_revenue,
  COALESCE(MAX(currency), 'usd')                          AS currency,
  COUNT(*) FILTER (WHERE stripe_subscription_id IS NOT NULL)::int AS stripe_subscribers,
  COUNT(*) FILTER (WHERE stripe_subscription_id IS NULL)::int     AS activation_subscribers,
  -- By plan breakdown
  jsonb_agg(
    DISTINCT jsonb_build_object(
      'plan_name', plan_name,
      'plan_price', plan_price,
      'count', 1
    )
  ) FILTER (WHERE plan_name IS NOT NULL) AS plan_distribution
FROM paid_subs;


-- ────────────────────────────────────────────────────────────
-- 5. admin_churn_metrics — trial vs paid churn detail
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_churn_metrics AS
WITH churned AS (
  SELECT
    s.tenant_id,
    s.status,
    s.canceled_at,
    s.created_at        AS subscription_created_at,
    s.current_period_end,
    p.name              AS plan_name,
    p.price             AS plan_price,
    s.billing_interval,
    s.paid_amount,
    -- Did this tenant ever have a paid active subscription?
    EXISTS (
      SELECT 1 FROM subscriptions s2
      JOIN plans p2 ON p2.id = s2.plan_id
      WHERE s2.tenant_id = s.tenant_id
        AND s2.status = 'active'
        AND p2.price > 0
        AND s2.id != s.id
    ) AS was_ever_paid,
    CASE
      WHEN s.canceled_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (s.canceled_at - s.created_at)) / 86400
      ELSE NULL
    END AS days_active_before_churn
  FROM subscriptions s
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE s.status = 'canceled'
)
SELECT
  COUNT(*)::int                                              AS total_churned,
  COUNT(*) FILTER (WHERE was_ever_paid OR plan_price > 0)::int  AS churned_from_paid,
  COUNT(*) FILTER (WHERE NOT was_ever_paid AND COALESCE(plan_price, 0) = 0)::int AS churned_from_trial,
  ROUND(AVG(days_active_before_churn) FILTER (WHERE was_ever_paid OR plan_price > 0), 1)::numeric
    AS avg_days_before_paid_churn,
  ROUND(AVG(days_active_before_churn) FILTER (WHERE NOT was_ever_paid AND COALESCE(plan_price, 0) = 0), 1)::numeric
    AS avg_days_before_trial_churn,
  -- Recent churn (last 30 days)
  COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days')::int
    AS churned_last_30d,
  COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days' AND (was_ever_paid OR plan_price > 0))::int
    AS paid_churned_last_30d,
  COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days' AND NOT was_ever_paid AND COALESCE(plan_price, 0) = 0)::int
    AS trial_churned_last_30d,
  -- Monthly churn rate for paid users
  -- (churned paid in last 30d) / (total active paid + churned paid in last 30d)
  CASE WHEN (
    (SELECT COUNT(*) FROM subscriptions ss JOIN plans pp ON pp.id = ss.plan_id WHERE ss.status = 'active' AND pp.price > 0)
    + COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days' AND (was_ever_paid OR plan_price > 0))
  ) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days' AND (was_ever_paid OR plan_price > 0))::numeric
      / (
        (SELECT COUNT(*) FROM subscriptions ss JOIN plans pp ON pp.id = ss.plan_id WHERE ss.status = 'active' AND pp.price > 0)
        + COUNT(*) FILTER (WHERE canceled_at >= now() - interval '30 days' AND (was_ever_paid OR plan_price > 0))
      ) * 100, 2
    )
    ELSE 0
  END::numeric AS monthly_paid_churn_rate_pct
FROM churned;


-- ────────────────────────────────────────────────────────────
-- 6. admin_meta_ads_cross_metrics — Meta Ads ↔ conversions
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_meta_ads_cross_metrics AS
WITH campaign_spend AS (
  SELECT
    COALESCE(campaign_name, 'Unknown') AS campaign_name,
    SUM(spend)::numeric                AS total_spend,
    SUM(impressions)::bigint           AS total_impressions,
    SUM(clicks)::bigint                AS total_clicks,
    SUM(conversions)::int              AS meta_conversions,
    MIN(date)                          AS first_date,
    MAX(date)                          AS last_date
  FROM meta_ads_snapshots
  WHERE level = 'campaign'
  GROUP BY COALESCE(campaign_name, 'Unknown')
),
campaign_leads AS (
  SELECT
    LOWER(la.utm_campaign) AS campaign_key,
    COUNT(DISTINCT la.tenant_id)::int AS total_leads,
    COUNT(DISTINCT la.tenant_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.tenant_id = la.tenant_id
          AND s.status = 'trialing'
      )
    )::int AS trial_leads,
    COUNT(DISTINCT la.tenant_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.tenant_id = la.tenant_id
          AND s.status = 'active'
          AND p.price > 0
      )
    )::int AS paid_leads,
    COUNT(DISTINCT la.tenant_id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.tenant_id = la.tenant_id
          AND s.status = 'canceled'
      )
    )::int AS churned_leads
  FROM lead_attribution la
  WHERE la.utm_campaign IS NOT NULL
  GROUP BY LOWER(la.utm_campaign)
),
campaign_access AS (
  SELECT
    LOWER(la.utm_campaign) AS campaign_key,
    COUNT(DISTINCT dal.user_id)::int AS users_with_access,
    COUNT(dal.id)::int AS total_page_views
  FROM lead_attribution la
  JOIN admin_dashboard_access_log dal ON dal.user_id = la.user_id
  WHERE la.utm_campaign IS NOT NULL
  GROUP BY LOWER(la.utm_campaign)
)
SELECT
  cs.campaign_name,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.meta_conversions,
  cs.first_date,
  cs.last_date,
  COALESCE(cl.total_leads, 0)     AS platform_leads,
  COALESCE(cl.trial_leads, 0)     AS trial_conversions,
  COALESCE(cl.paid_leads, 0)      AS paid_conversions,
  COALESCE(cl.churned_leads, 0)   AS churned_leads,
  COALESCE(ca.users_with_access, 0)  AS engaged_users,
  COALESCE(ca.total_page_views, 0)   AS total_page_views,
  -- Cost metrics
  CASE WHEN COALESCE(cl.total_leads, 0) > 0
    THEN ROUND(cs.total_spend / cl.total_leads, 2)
    ELSE 0
  END AS cost_per_lead,
  CASE WHEN COALESCE(cl.paid_leads, 0) > 0
    THEN ROUND(cs.total_spend / cl.paid_leads, 2)
    ELSE 0
  END AS cost_per_paid_acquisition,
  CASE WHEN COALESCE(cl.trial_leads, 0) > 0
    THEN ROUND(cs.total_spend / cl.trial_leads, 2)
    ELSE 0
  END AS cost_per_trial,
  -- Conversion rates
  CASE WHEN COALESCE(cl.total_leads, 0) > 0
    THEN ROUND(cl.paid_leads::numeric / cl.total_leads * 100, 2)
    ELSE 0
  END AS lead_to_paid_pct,
  CASE WHEN COALESCE(cl.total_leads, 0) > 0
    THEN ROUND(cl.trial_leads::numeric / cl.total_leads * 100, 2)
    ELSE 0
  END AS lead_to_trial_pct,
  -- Engagement
  CASE WHEN COALESCE(cl.total_leads, 0) > 0
    THEN ROUND(COALESCE(ca.users_with_access, 0)::numeric / cl.total_leads * 100, 2)
    ELSE 0
  END AS lead_engagement_pct
FROM campaign_spend cs
LEFT JOIN campaign_leads cl
  ON cl.campaign_key = LOWER(cs.campaign_name)
LEFT JOIN campaign_access ca
  ON ca.campaign_key = LOWER(cs.campaign_name);


-- ────────────────────────────────────────────────────────────
-- 7. admin_dashboard_access_metrics — engagement aggregation
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_dashboard_access_metrics AS
SELECT
  COUNT(DISTINCT user_id)::int                                     AS unique_users,
  COUNT(*)::int                                                    AS total_page_views,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int   AS views_last_7d,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int  AS views_last_30d,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days')::int
    AS active_users_7d,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days')::int
    AS active_users_30d,
  -- By page
  jsonb_agg(
    DISTINCT jsonb_build_object('page', page)
  ) FILTER (WHERE page IS NOT NULL) AS pages_tracked,
  -- DAU/MAU ratio (stickiness)
  CASE WHEN COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days') > 0
    THEN ROUND(
      (COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '1 day'))::numeric
      / COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days') * 100
    , 2)
    ELSE 0
  END AS dau_mau_ratio_pct
FROM admin_dashboard_access_log;


-- ────────────────────────────────────────────────────────────
-- 8. Replace admin_active_users — add classification & is_paid_user
-- ────────────────────────────────────────────────────────────

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
  -- ★ NEW: Classification fields
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
-- ★ CHANGED: LEFT JOIN instead of INNER JOIN on subscriptions
-- so users without subscriptions still appear (as "free")
LEFT JOIN subscriptions s
  ON s.tenant_id = tu.tenant_id
  AND s.status IN ('active', 'trialing')
LEFT JOIN plans pl
  ON pl.id = s.plan_id
-- ★ NEW: Activation plan lookup
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
