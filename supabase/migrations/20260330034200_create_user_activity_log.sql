-- ============================================================
-- User Activity Log: comprehensive tracking of all user actions
-- Supports both anonymous visitors and authenticated users.
-- No data is ever deleted — full history is retained.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Actor (nullable for anonymous visitors) ────────────────
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
  session_id      TEXT,              -- client-generated UUID for anonymous session tracking

  -- ── Event classification ───────────────────────────────────
  event_type      TEXT NOT NULL,     -- e.g. 'page_view', 'onboarding_step', 'button_click', 'form_submit'
  event_action    TEXT NOT NULL,     -- e.g. 'entered', 'completed', 'skipped', 'clicked', 'errored'
  event_target    TEXT,              -- e.g. 'signup_form', 'onboarding_step_2', '/dashboard/topics'

  -- ── Flexible payload ───────────────────────────────────────
  metadata        JSONB DEFAULT '{}',

  -- ── Context ────────────────────────────────────────────────
  page_url        TEXT,
  referrer        TEXT,
  user_agent      TEXT,
  ip_address      INET,
  screen_resolution TEXT,
  timezone        TEXT,
  locale          TEXT,

  -- ── Timestamps ─────────────────────────────────────────────
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────

-- User journey timeline (authenticated users)
CREATE INDEX IF NOT EXISTS idx_ual_user_created
  ON user_activity_log (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Tenant activity feed
CREATE INDEX IF NOT EXISTS idx_ual_tenant_created
  ON user_activity_log (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Anonymous session reconstruction
CREATE INDEX IF NOT EXISTS idx_ual_session_created
  ON user_activity_log (session_id, created_at)
  WHERE session_id IS NOT NULL;

-- Funnel analysis (event type + action)
CREATE INDEX IF NOT EXISTS idx_ual_event_type_action
  ON user_activity_log (event_type, event_action);

-- Time-range scans (BRIN for ordered time data — very efficient for append-only)
CREATE INDEX IF NOT EXISTS idx_ual_created_brin
  ON user_activity_log USING brin (created_at);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- SA can see all; no public SELECT — this is internal data only
-- Mutations happen exclusively via service_role (Edge Function)
-- No policies needed: service_role bypasses RLS, and we don't expose this via frontend
