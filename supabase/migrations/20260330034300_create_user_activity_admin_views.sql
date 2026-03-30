-- ============================================================
-- Admin views for user activity analysis
-- Funnel analysis, drop-off detection, feature engagement
-- ============================================================

-- ── 1. Onboarding Funnel View ────────────────────────────────
-- Shows how many users reached each onboarding step and how many completed it.

CREATE OR REPLACE VIEW admin_onboarding_funnel AS
WITH signup_users AS (
  -- All users who signed up (have a profile)
  SELECT
    p.user_id,
    p.email,
    p.full_name,
    p.created_at AS signup_at,
    tu.tenant_id,
    t.name AS tenant_name,
    p.has_seen_onboarding,
    -- Check if tenant has an active subscription
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.tenant_id = tu.tenant_id
        AND s.status IN ('active', 'trialing')
    ) AS has_plan
  FROM profiles p
  JOIN tenant_users tu ON tu.user_id = p.user_id AND tu.is_active = true
  JOIN tenants t ON t.id = tu.tenant_id
),
onboarding_events AS (
  -- All onboarding-related events per user
  SELECT
    user_id,
    event_type,
    event_action,
    event_target,
    metadata,
    created_at
  FROM user_activity_log
  WHERE event_type LIKE 'onboarding_%'
    AND user_id IS NOT NULL
),
user_steps AS (
  SELECT
    su.user_id,
    su.email,
    su.full_name,
    su.signup_at,
    su.tenant_name,
    su.has_plan,
    su.has_seen_onboarding,
    -- Step flags based on logged events
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_target = 'welcome') AS reached_welcome,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_target = 'analyze') AS reached_analyze,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_type = 'onboarding_analyze' AND oe.event_action = 'completed') AS completed_analyze,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_target = 'topics') AS reached_topics,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_target = 'prompts') AS reached_prompts,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_target = 'plans') AS reached_plans,
    EXISTS (SELECT 1 FROM onboarding_events oe WHERE oe.user_id = su.user_id AND oe.event_type = 'onboarding_plan' AND oe.event_action = 'checkout_started') AS started_checkout,
    -- Last activity
    (SELECT MAX(created_at) FROM user_activity_log ual WHERE ual.user_id = su.user_id) AS last_activity_at
  FROM signup_users su
)
SELECT
  user_id,
  email,
  full_name,
  signup_at,
  tenant_name,
  has_plan,
  has_seen_onboarding,
  reached_welcome,
  reached_analyze,
  completed_analyze,
  reached_topics,
  reached_prompts,
  reached_plans,
  started_checkout,
  last_activity_at,
  -- Determine the last step the user reached
  CASE
    WHEN has_plan THEN 'activated'
    WHEN started_checkout THEN 'checkout'
    WHEN reached_plans THEN 'plans'
    WHEN reached_prompts THEN 'prompts'
    WHEN reached_topics THEN 'topics'
    WHEN completed_analyze THEN 'analyze_done'
    WHEN reached_analyze THEN 'analyze'
    WHEN reached_welcome THEN 'welcome'
    ELSE 'signup_only'
  END AS last_step,
  -- Days since signup
  EXTRACT(DAY FROM now() - signup_at)::int AS days_since_signup
FROM user_steps;


-- ── 2. Feature Engagement View ───────────────────────────────
-- Daily summary of feature usage across all users

CREATE OR REPLACE VIEW admin_feature_engagement AS
SELECT
  created_at::date AS log_date,
  event_type,
  event_action,
  event_target,
  COUNT(*)::int AS event_count,
  COUNT(DISTINCT user_id)::int AS unique_users,
  COUNT(DISTINCT tenant_id)::int AS unique_tenants,
  COUNT(DISTINCT session_id)::int AS unique_sessions
FROM user_activity_log
GROUP BY created_at::date, event_type, event_action, event_target;


-- ── 3. Drop-offs: users who signed up but never completed onboarding ──

CREATE OR REPLACE VIEW admin_onboarding_dropoffs AS
SELECT
  p.user_id,
  p.email,
  p.full_name,
  p.created_at AS signup_at,
  t.name AS tenant_name,
  EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.tenant_id = tu.tenant_id
      AND s.status IN ('active', 'trialing')
  ) AS has_plan,
  p.has_seen_onboarding,
  -- Last event
  latest.last_event_type,
  latest.last_event_action,
  latest.last_event_target,
  latest.last_event_at,
  latest.total_events::int,
  -- staleness
  EXTRACT(HOURS FROM now() - COALESCE(latest.last_event_at, p.created_at))::int AS hours_since_last_activity
FROM profiles p
JOIN tenant_users tu ON tu.user_id = p.user_id AND tu.is_active = true
JOIN tenants t ON t.id = tu.tenant_id
LEFT JOIN LATERAL (
  SELECT
    ual.event_type AS last_event_type,
    ual.event_action AS last_event_action,
    ual.event_target AS last_event_target,
    ual.created_at AS last_event_at,
    (SELECT COUNT(*) FROM user_activity_log ual2 WHERE ual2.user_id = p.user_id) AS total_events
  FROM user_activity_log ual
  WHERE ual.user_id = p.user_id
  ORDER BY ual.created_at DESC
  LIMIT 1
) latest ON true
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.tenant_id = tu.tenant_id
    AND s.status IN ('active', 'trialing')
)
ORDER BY p.created_at DESC;


-- ── 4. User Journey Timeline (SA detail) ─────────────────────
-- Complete event history for a specific user, used in SA user detail page

CREATE OR REPLACE VIEW admin_user_activity_timeline AS
SELECT
  ual.id,
  ual.user_id,
  ual.tenant_id,
  ual.session_id,
  ual.event_type,
  ual.event_action,
  ual.event_target,
  ual.metadata,
  ual.page_url,
  ual.referrer,
  ual.user_agent,
  ual.ip_address,
  ual.screen_resolution,
  ual.locale,
  ual.created_at,
  -- Join user info when available
  p.email AS user_email,
  p.full_name AS user_name,
  t.name AS tenant_name
FROM user_activity_log ual
LEFT JOIN profiles p ON p.user_id = ual.user_id
LEFT JOIN tenants t ON t.id = ual.tenant_id;
