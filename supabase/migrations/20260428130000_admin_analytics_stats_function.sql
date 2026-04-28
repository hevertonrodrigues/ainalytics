-- ============================================================
-- get_admin_analytics_stats(p_days)
-- Server-side aggregation for the SA Analytics page.
-- Replaces the in-memory JS aggregation in the admin-analytics Edge Function,
-- which was silently capped at PostgREST's 1000-row max-rows limit.
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_analytics_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => p_days);
  v_today  date        := (now() AT TIME ZONE 'UTC')::date;
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT
      user_id,
      tenant_id,
      session_id,
      event_type,
      event_action,
      event_target,
      created_at,
      (created_at AT TIME ZONE 'UTC')::date AS log_date
    FROM user_activity_log
    WHERE created_at >= v_cutoff
  ),
  totals AS (
    SELECT
      COUNT(*)::int                                                        AS total_events,
      COUNT(DISTINCT user_id)::int                                         AS unique_users,
      COUNT(DISTINCT session_id)::int                                      AS unique_sessions,
      COUNT(DISTINCT tenant_id)::int                                       AS unique_tenants,
      COUNT(*) FILTER (WHERE user_id IS NULL)::int                         AS anonymous_events,
      COUNT(*) FILTER (WHERE user_id IS NOT NULL)::int                     AS authenticated_events,
      COUNT(*)              FILTER (WHERE log_date = v_today)::int         AS events_today,
      COUNT(DISTINCT user_id)    FILTER (WHERE log_date = v_today)::int    AS users_today,
      COUNT(DISTINCT session_id) FILTER (WHERE log_date = v_today)::int    AS sessions_today
    FROM base
  ),
  daily AS (
    SELECT
      log_date,
      COUNT(*)::int                   AS events,
      COUNT(DISTINCT user_id)::int    AS users,
      COUNT(DISTINCT session_id)::int AS sessions
    FROM base
    GROUP BY log_date
    ORDER BY log_date
  ),
  top_events AS (
    SELECT event_type, event_action, COUNT(*)::int AS cnt
    FROM base
    GROUP BY event_type, event_action
    ORDER BY cnt DESC
    LIMIT 15
  ),
  top_pages AS (
    SELECT event_target AS page, COUNT(*)::int AS views
    FROM base
    WHERE event_type   = 'page_view'
      AND event_action = 'entered'
      AND event_target IS NOT NULL
    GROUP BY event_target
    ORDER BY views DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total_events',         t.total_events,
    'unique_users',         t.unique_users,
    'unique_sessions',      t.unique_sessions,
    'unique_tenants',       t.unique_tenants,
    'anonymous_events',     t.anonymous_events,
    'authenticated_events', t.authenticated_events,
    'events_today',         t.events_today,
    'users_today',          t.users_today,
    'sessions_today',       t.sessions_today,
    'daily', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'log_date', to_char(d.log_date, 'YYYY-MM-DD'),
        'events',   d.events,
        'users',    d.users,
        'sessions', d.sessions
      ) ORDER BY d.log_date) FROM daily d),
      '[]'::jsonb
    ),
    'top_events', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'event_type',   e.event_type,
        'event_action', e.event_action,
        'cnt',          e.cnt
      ) ORDER BY e.cnt DESC) FROM top_events e),
      '[]'::jsonb
    ),
    'top_pages', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'page',  p.page,
        'views', p.views
      ) ORDER BY p.views DESC) FROM top_pages p),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM totals t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_analytics_stats(int) TO service_role;
