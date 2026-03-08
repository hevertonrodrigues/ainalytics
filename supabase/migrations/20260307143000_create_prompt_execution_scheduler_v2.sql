-- ============================================================
-- Prompt execution scheduler v2
-- Recurring plan-driven execution without changing prompt_answers
-- or prompt_answer_sources schema.
-- ============================================================

-- ── 1. Enum types ───────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_refresh_unit') THEN
    CREATE TYPE prompt_refresh_unit AS ENUM ('day', 'week', 'month');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_execution_target_status') THEN
    CREATE TYPE prompt_execution_target_status AS ENUM ('active', 'paused', 'canceled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_execution_run_status') THEN
    CREATE TYPE prompt_execution_run_status AS ENUM ('queued', 'dispatched', 'processing', 'completed', 'failed', 'canceled');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_execution_trigger_source') THEN
    CREATE TYPE prompt_execution_trigger_source AS ENUM ('scheduled', 'manual', 'retry', 'backfill');
  END IF;
END $$;

-- ── 2. Plans: typed prompt cadence columns ──────────────────

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS prompt_refresh_unit prompt_refresh_unit,
  ADD COLUMN IF NOT EXISTS prompt_refresh_value integer;

UPDATE plans
SET
  prompt_refresh_unit = CASE COALESCE(settings->>'refresh_rate', 'monthly')
    WHEN 'daily' THEN 'day'::prompt_refresh_unit
    WHEN 'weekly' THEN 'week'::prompt_refresh_unit
    ELSE 'month'::prompt_refresh_unit
  END,
  prompt_refresh_value = COALESCE(prompt_refresh_value, 1)
WHERE prompt_refresh_unit IS NULL
   OR prompt_refresh_value IS NULL;

ALTER TABLE plans
  ALTER COLUMN prompt_refresh_unit SET DEFAULT 'month',
  ALTER COLUMN prompt_refresh_unit SET NOT NULL,
  ALTER COLUMN prompt_refresh_value SET DEFAULT 1,
  ALTER COLUMN prompt_refresh_value SET NOT NULL;

ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_prompt_refresh_value_check;
ALTER TABLE plans
  ADD CONSTRAINT plans_prompt_refresh_value_check
  CHECK (prompt_refresh_value >= 1 AND prompt_refresh_value <= 365);

-- ── 3. General settings helpers ─────────────────────────────

INSERT INTO general_settings (key, value) VALUES
  ('PROMPT_EXECUTION_DISPATCH_LIMIT', '10'),
  ('PROMPT_EXECUTION_MAX_ATTEMPTS', '3'),
  ('PROMPT_EXECUTION_LEASE_SECONDS', '600')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_setting_int(p_key text, p_default int)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(
    (SELECT value::int FROM general_settings WHERE key = p_key),
    p_default
  );
$$;

-- ── 4. Scheduler helper functions ───────────────────────────

CREATE OR REPLACE FUNCTION public.add_prompt_refresh_interval(
  p_base timestamptz,
  p_unit prompt_refresh_unit,
  p_value int
)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public
AS $$
BEGIN
  RETURN CASE p_unit
    WHEN 'day'::prompt_refresh_unit THEN p_base + make_interval(days => p_value)
    WHEN 'week'::prompt_refresh_unit THEN p_base + make_interval(days => 7 * p_value)
    WHEN 'month'::prompt_refresh_unit THEN p_base + make_interval(months => p_value)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_prompt_next_due(
  p_anchor timestamptz,
  p_unit prompt_refresh_unit,
  p_value int
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT public.add_prompt_refresh_interval(p_anchor, p_unit, p_value);
$$;

CREATE OR REPLACE FUNCTION public.advance_prompt_due_to_future(
  p_due timestamptz,
  p_unit prompt_refresh_unit,
  p_value int,
  p_reference timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO public
AS $$
DECLARE
  v_due timestamptz := p_due;
BEGIN
  IF v_due IS NULL THEN
    RETURN p_reference;
  END IF;

  WHILE v_due <= p_reference LOOP
    v_due := public.add_prompt_refresh_interval(v_due, p_unit, p_value);
  END LOOP;

  RETURN v_due;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_prompt_retry_backoff(
  p_attempt_count int
)
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT make_interval(secs => LEAST(300 * CAST(power(2::numeric, GREATEST(p_attempt_count - 1, 0)) AS int), 3600));
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_active_prompt_subscription(p_tenant_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  plan_id uuid,
  cadence_unit prompt_refresh_unit,
  cadence_value int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    s.id AS subscription_id,
    s.plan_id,
    p.prompt_refresh_unit AS cadence_unit,
    p.prompt_refresh_value AS cadence_value
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('active'::subscription_status, 'trialing'::subscription_status)
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- ── 5. Scheduler tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_execution_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  cadence_unit prompt_refresh_unit NOT NULL,
  cadence_value INTEGER NOT NULL DEFAULT 1 CHECK (cadence_value >= 1 AND cadence_value <= 365),
  schedule_status prompt_execution_target_status NOT NULL DEFAULT 'active',
  next_due_at TIMESTAMPTZ,
  last_due_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  latest_run_id UUID,
  latest_answer_id UUID REFERENCES prompt_answers(id) ON DELETE SET NULL,
  latest_success_answer_id UUID REFERENCES prompt_answers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompt_execution_targets_unique UNIQUE (tenant_id, prompt_id, platform_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_execution_targets_tenant_id
  ON prompt_execution_targets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_targets_status_due
  ON prompt_execution_targets(schedule_status, next_due_at);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_targets_prompt_id
  ON prompt_execution_targets(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_targets_latest_answer_id
  ON prompt_execution_targets(latest_answer_id);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_targets_latest_success_answer_id
  ON prompt_execution_targets(latest_success_answer_id);

ALTER TABLE prompt_execution_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_execution_targets_select_own_tenant" ON prompt_execution_targets;
CREATE POLICY "prompt_execution_targets_select_own_tenant"
  ON prompt_execution_targets FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );

DROP TRIGGER IF EXISTS set_prompt_execution_targets_updated_at ON prompt_execution_targets;
CREATE TRIGGER set_prompt_execution_targets_updated_at
  BEFORE UPDATE ON prompt_execution_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS prompt_execution_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES prompt_execution_targets(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  trigger_source prompt_execution_trigger_source NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status prompt_execution_run_status NOT NULL DEFAULT 'queued',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  dispatch_token UUID,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  prompt_answer_id UUID REFERENCES prompt_answers(id) ON DELETE SET NULL,
  error_class TEXT,
  error_message TEXT,
  provider_http_status INTEGER,
  provider_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_execution_runs_tenant_id
  ON prompt_execution_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_runs_target_id
  ON prompt_execution_runs(target_id);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_runs_status_available
  ON prompt_execution_runs(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_execution_runs_prompt_answer_id
  ON prompt_execution_runs(prompt_answer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_execution_runs_active_target
  ON prompt_execution_runs(target_id)
  WHERE status IN (
    'queued'::prompt_execution_run_status,
    'dispatched'::prompt_execution_run_status,
    'processing'::prompt_execution_run_status
  );

ALTER TABLE prompt_execution_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prompt_execution_runs_select_own_tenant" ON prompt_execution_runs;
CREATE POLICY "prompt_execution_runs_select_own_tenant"
  ON prompt_execution_runs FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );

DROP TRIGGER IF EXISTS set_prompt_execution_runs_updated_at ON prompt_execution_runs;
CREATE TRIGGER set_prompt_execution_runs_updated_at
  BEFORE UPDATE ON prompt_execution_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'prompt_execution_targets'
      AND constraint_name = 'prompt_execution_targets_latest_run_id_fkey'
  ) THEN
    ALTER TABLE prompt_execution_targets
      ADD CONSTRAINT prompt_execution_targets_latest_run_id_fkey
      FOREIGN KEY (latest_run_id) REFERENCES prompt_execution_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 6. Internal scheduler RPCs ──────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_prompt_execution_target(
  p_tenant_id uuid,
  p_prompt_id uuid,
  p_platform_id uuid,
  p_model_id uuid
)
RETURNS prompt_execution_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_subscription RECORD;
  v_prompt_active BOOLEAN := false;
  v_model_active BOOLEAN := false;
  v_schedule_status prompt_execution_target_status := 'paused'::prompt_execution_target_status;
  v_latest_answer_id UUID;
  v_latest_answer_at TIMESTAMPTZ;
  v_latest_success_answer_id UUID;
  v_latest_success_at TIMESTAMPTZ;
  v_target prompt_execution_targets;
BEGIN
  SELECT *
  INTO v_subscription
  FROM public.get_tenant_active_prompt_subscription(p_tenant_id);

  IF v_subscription.subscription_id IS NULL THEN
    RAISE EXCEPTION 'Active subscription required';
  END IF;

  SELECT p.is_active
  INTO v_prompt_active
  FROM prompts p
  WHERE p.id = p_prompt_id
    AND p.tenant_id = p_tenant_id;

  SELECT true
  INTO v_model_active
  FROM tenant_platform_models tpm
  WHERE tpm.tenant_id = p_tenant_id
    AND tpm.platform_id = p_platform_id
    AND tpm.model_id = p_model_id
    AND tpm.is_active = true
  LIMIT 1;

  IF COALESCE(v_prompt_active, false) AND COALESCE(v_model_active, false) THEN
    v_schedule_status := 'active'::prompt_execution_target_status;
  END IF;

  SELECT pa.id, pa.searched_at
  INTO v_latest_answer_id, v_latest_answer_at
  FROM prompt_answers pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.prompt_id = p_prompt_id
    AND pa.platform_id = p_platform_id
    AND pa.model_id = p_model_id
    AND pa.deleted = false
  ORDER BY pa.searched_at DESC, pa.created_at DESC, pa.id DESC
  LIMIT 1;

  SELECT pa.id, pa.searched_at
  INTO v_latest_success_answer_id, v_latest_success_at
  FROM prompt_answers pa
  WHERE pa.tenant_id = p_tenant_id
    AND pa.prompt_id = p_prompt_id
    AND pa.platform_id = p_platform_id
    AND pa.model_id = p_model_id
    AND pa.deleted = false
    AND pa.error IS NULL
  ORDER BY pa.searched_at DESC, pa.created_at DESC, pa.id DESC
  LIMIT 1;

  INSERT INTO prompt_execution_targets (
    tenant_id,
    prompt_id,
    platform_id,
    model_id,
    subscription_id,
    plan_id,
    cadence_unit,
    cadence_value,
    schedule_status,
    next_due_at,
    last_due_at,
    last_completed_at,
    last_success_at,
    latest_answer_id,
    latest_success_answer_id
  )
  VALUES (
    p_tenant_id,
    p_prompt_id,
    p_platform_id,
    p_model_id,
    v_subscription.subscription_id,
    v_subscription.plan_id,
    v_subscription.cadence_unit,
    v_subscription.cadence_value,
    v_schedule_status,
    CASE
      WHEN v_schedule_status = 'active'::prompt_execution_target_status THEN
        COALESCE(
          public.compute_prompt_next_due(v_latest_answer_at, v_subscription.cadence_unit, v_subscription.cadence_value),
          now()
        )
      ELSE NULL
    END,
    v_latest_answer_at,
    v_latest_answer_at,
    v_latest_success_at,
    v_latest_answer_id,
    v_latest_success_answer_id
  )
  ON CONFLICT (tenant_id, prompt_id, platform_id, model_id)
  DO UPDATE
  SET
    subscription_id = EXCLUDED.subscription_id,
    plan_id = EXCLUDED.plan_id,
    cadence_unit = EXCLUDED.cadence_unit,
    cadence_value = EXCLUDED.cadence_value,
    schedule_status = EXCLUDED.schedule_status,
    next_due_at = CASE
      WHEN EXCLUDED.schedule_status = 'active'::prompt_execution_target_status THEN
        COALESCE(prompt_execution_targets.next_due_at, EXCLUDED.next_due_at, now())
      ELSE NULL
    END,
    latest_answer_id = COALESCE(EXCLUDED.latest_answer_id, prompt_execution_targets.latest_answer_id),
    latest_success_answer_id = COALESCE(EXCLUDED.latest_success_answer_id, prompt_execution_targets.latest_success_answer_id),
    last_due_at = COALESCE(prompt_execution_targets.last_due_at, EXCLUDED.last_due_at),
    last_completed_at = COALESCE(prompt_execution_targets.last_completed_at, EXCLUDED.last_completed_at),
    last_success_at = COALESCE(prompt_execution_targets.last_success_at, EXCLUDED.last_success_at),
    updated_at = now()
  RETURNING *
  INTO v_target;

  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_prompt_execution_targets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_upserted integer := 0;
  v_paused integer := 0;
BEGIN
  WITH active_subscriptions AS (
    SELECT DISTINCT ON (s.tenant_id)
      s.tenant_id,
      s.id AS subscription_id,
      s.plan_id,
      p.prompt_refresh_unit AS cadence_unit,
      p.prompt_refresh_value AS cadence_value
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.status IN ('active'::subscription_status, 'trialing'::subscription_status)
    ORDER BY s.tenant_id, s.created_at DESC
  ),
  desired AS (
    SELECT
      pr.tenant_id,
      pr.id AS prompt_id,
      tpm.platform_id,
      tpm.model_id,
      active_subscriptions.subscription_id,
      active_subscriptions.plan_id,
      active_subscriptions.cadence_unit,
      active_subscriptions.cadence_value,
      latest_all.answer_id AS latest_answer_id,
      latest_all.searched_at AS latest_answer_at,
      latest_ok.answer_id AS latest_success_answer_id,
      latest_ok.searched_at AS latest_success_at
    FROM prompts pr
    JOIN active_subscriptions ON active_subscriptions.tenant_id = pr.tenant_id
    JOIN tenant_platform_models tpm
      ON tpm.tenant_id = pr.tenant_id
     AND tpm.is_active = true
    LEFT JOIN LATERAL (
      SELECT pa.id AS answer_id, pa.searched_at
      FROM prompt_answers pa
      WHERE pa.tenant_id = pr.tenant_id
        AND pa.prompt_id = pr.id
        AND pa.platform_id = tpm.platform_id
        AND pa.model_id = tpm.model_id
        AND pa.deleted = false
      ORDER BY pa.searched_at DESC, pa.created_at DESC, pa.id DESC
      LIMIT 1
    ) latest_all ON true
    LEFT JOIN LATERAL (
      SELECT pa.id AS answer_id, pa.searched_at
      FROM prompt_answers pa
      WHERE pa.tenant_id = pr.tenant_id
        AND pa.prompt_id = pr.id
        AND pa.platform_id = tpm.platform_id
        AND pa.model_id = tpm.model_id
        AND pa.deleted = false
        AND pa.error IS NULL
      ORDER BY pa.searched_at DESC, pa.created_at DESC, pa.id DESC
      LIMIT 1
    ) latest_ok ON true
    WHERE pr.is_active = true
  ),
  upserted AS (
    INSERT INTO prompt_execution_targets (
      tenant_id,
      prompt_id,
      platform_id,
      model_id,
      subscription_id,
      plan_id,
      cadence_unit,
      cadence_value,
      schedule_status,
      next_due_at,
      last_due_at,
      last_completed_at,
      last_success_at,
      latest_answer_id,
      latest_success_answer_id
    )
    SELECT
      desired.tenant_id,
      desired.prompt_id,
      desired.platform_id,
      desired.model_id,
      desired.subscription_id,
      desired.plan_id,
      desired.cadence_unit,
      desired.cadence_value,
      'active'::prompt_execution_target_status,
      COALESCE(
        public.compute_prompt_next_due(desired.latest_answer_at, desired.cadence_unit, desired.cadence_value),
        now()
      ),
      desired.latest_answer_at,
      desired.latest_answer_at,
      desired.latest_success_at,
      desired.latest_answer_id,
      desired.latest_success_answer_id
    FROM desired
    ON CONFLICT (tenant_id, prompt_id, platform_id, model_id)
    DO UPDATE
    SET
      subscription_id = EXCLUDED.subscription_id,
      plan_id = EXCLUDED.plan_id,
      cadence_unit = EXCLUDED.cadence_unit,
      cadence_value = EXCLUDED.cadence_value,
      schedule_status = 'active'::prompt_execution_target_status,
      next_due_at = CASE
        WHEN prompt_execution_targets.cadence_unit IS DISTINCT FROM EXCLUDED.cadence_unit
          OR prompt_execution_targets.cadence_value IS DISTINCT FROM EXCLUDED.cadence_value
        THEN
          COALESCE(
            public.compute_prompt_next_due(prompt_execution_targets.last_due_at, EXCLUDED.cadence_unit, EXCLUDED.cadence_value),
            public.compute_prompt_next_due(prompt_execution_targets.last_completed_at, EXCLUDED.cadence_unit, EXCLUDED.cadence_value),
            prompt_execution_targets.next_due_at,
            EXCLUDED.next_due_at,
            now()
          )
        ELSE COALESCE(prompt_execution_targets.next_due_at, EXCLUDED.next_due_at, now())
      END,
      latest_answer_id = COALESCE(EXCLUDED.latest_answer_id, prompt_execution_targets.latest_answer_id),
      latest_success_answer_id = COALESCE(EXCLUDED.latest_success_answer_id, prompt_execution_targets.latest_success_answer_id),
      last_due_at = COALESCE(prompt_execution_targets.last_due_at, EXCLUDED.last_due_at),
      last_completed_at = COALESCE(prompt_execution_targets.last_completed_at, EXCLUDED.last_completed_at),
      last_success_at = COALESCE(prompt_execution_targets.last_success_at, EXCLUDED.last_success_at),
      updated_at = now()
    RETURNING 1
  )
  SELECT count(*) INTO v_upserted FROM upserted;

  WITH active_subscriptions AS (
    SELECT DISTINCT ON (s.tenant_id) s.tenant_id
    FROM subscriptions s
    WHERE s.status IN ('active'::subscription_status, 'trialing'::subscription_status)
    ORDER BY s.tenant_id, s.created_at DESC
  ),
  desired AS (
    SELECT
      pr.tenant_id,
      pr.id AS prompt_id,
      tpm.platform_id,
      tpm.model_id
    FROM prompts pr
    JOIN active_subscriptions ON active_subscriptions.tenant_id = pr.tenant_id
    JOIN tenant_platform_models tpm
      ON tpm.tenant_id = pr.tenant_id
     AND tpm.is_active = true
    WHERE pr.is_active = true
  )
  UPDATE prompt_execution_targets pet
  SET
    schedule_status = 'paused'::prompt_execution_target_status,
    next_due_at = NULL,
    updated_at = now()
  WHERE pet.schedule_status <> 'canceled'::prompt_execution_target_status
    AND NOT EXISTS (
      SELECT 1
      FROM desired d
      WHERE d.tenant_id = pet.tenant_id
        AND d.prompt_id = pet.prompt_id
        AND d.platform_id = pet.platform_id
        AND d.model_id = pet.model_id
    );

  GET DIAGNOSTICS v_paused = ROW_COUNT;

  RETURN v_upserted + v_paused;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_due_prompt_execution_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_inserted integer := 0;
  v_max_attempts integer := public.get_setting_int('PROMPT_EXECUTION_MAX_ATTEMPTS', 3);
BEGIN
  WITH due_targets AS (
    SELECT pet.*
    FROM prompt_execution_targets pet
    WHERE pet.schedule_status = 'active'::prompt_execution_target_status
      AND pet.next_due_at IS NOT NULL
      AND pet.next_due_at <= now()
      AND NOT EXISTS (
        SELECT 1
        FROM prompt_execution_runs per
        WHERE per.target_id = pet.id
          AND per.status IN (
            'queued'::prompt_execution_run_status,
            'dispatched'::prompt_execution_run_status,
            'processing'::prompt_execution_run_status
          )
      )
    ORDER BY pet.next_due_at ASC
  )
  INSERT INTO prompt_execution_runs (
    tenant_id,
    target_id,
    prompt_id,
    platform_id,
    model_id,
    subscription_id,
    plan_id,
    trigger_source,
    scheduled_for,
    status,
    max_attempts,
    available_at
  )
  SELECT
    due_targets.tenant_id,
    due_targets.id,
    due_targets.prompt_id,
    due_targets.platform_id,
    due_targets.model_id,
    due_targets.subscription_id,
    due_targets.plan_id,
    'scheduled'::prompt_execution_trigger_source,
    due_targets.next_due_at,
    'queued'::prompt_execution_run_status,
    v_max_attempts,
    now()
  FROM due_targets;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_prompt_execution_runs(p_batch_size integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  target_id uuid,
  prompt_id uuid,
  platform_id uuid,
  model_id uuid,
  dispatch_token uuid,
  scheduled_for timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_lease_seconds integer := public.get_setting_int('PROMPT_EXECUTION_LEASE_SECONDS', 600);
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT per.id
    FROM prompt_execution_runs per
    WHERE per.status = 'queued'::prompt_execution_run_status
      AND per.available_at <= now()
    ORDER BY per.scheduled_for ASC, per.created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE prompt_execution_runs per
  SET
    status = 'dispatched'::prompt_execution_run_status,
    attempt_count = per.attempt_count + 1,
    dispatch_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => v_lease_seconds),
    updated_at = now()
  FROM claimed
  WHERE per.id = claimed.id
  RETURNING
    per.id,
    per.tenant_id,
    per.target_id,
    per.prompt_id,
    per.platform_id,
    per.model_id,
    per.dispatch_token,
    per.scheduled_for;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_prompt_execution_run(
  p_run_id uuid,
  p_dispatch_token uuid
)
RETURNS prompt_execution_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_run prompt_execution_runs;
BEGIN
  UPDATE prompt_execution_runs per
  SET
    status = 'processing'::prompt_execution_run_status,
    started_at = COALESCE(per.started_at, now()),
    updated_at = now()
  WHERE per.id = p_run_id
    AND per.dispatch_token = p_dispatch_token
    AND per.status = 'dispatched'::prompt_execution_run_status
    AND (per.lease_expires_at IS NULL OR per.lease_expires_at > now())
  RETURNING * INTO v_run;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Run not claimable';
  END IF;

  UPDATE prompt_execution_targets pet
  SET
    last_started_at = now(),
    latest_run_id = v_run.id,
    updated_at = now()
  WHERE pet.id = v_run.target_id;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_prompt_execution_run(
  p_run_id uuid,
  p_prompt_answer_id uuid DEFAULT NULL,
  p_final_status prompt_execution_run_status DEFAULT 'completed',
  p_error_class text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_provider_http_status integer DEFAULT NULL,
  p_provider_request_id text DEFAULT NULL,
  p_retryable boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_run prompt_execution_runs;
  v_target prompt_execution_targets;
BEGIN
  SELECT * INTO v_run
  FROM prompt_execution_runs
  WHERE id = p_run_id;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Run not found';
  END IF;

  IF p_retryable AND v_run.attempt_count < v_run.max_attempts THEN
    UPDATE prompt_execution_runs
    SET
      status = 'queued'::prompt_execution_run_status,
      available_at = now() + public.get_prompt_retry_backoff(v_run.attempt_count),
      lease_expires_at = NULL,
      dispatch_token = NULL,
      error_class = p_error_class,
      error_message = p_error_message,
      provider_http_status = p_provider_http_status,
      provider_request_id = p_provider_request_id,
      updated_at = now()
    WHERE id = p_run_id;

    RETURN;
  END IF;

  UPDATE prompt_execution_runs
  SET
    status = p_final_status,
    prompt_answer_id = COALESCE(p_prompt_answer_id, prompt_answer_id),
    error_class = p_error_class,
    error_message = p_error_message,
    provider_http_status = p_provider_http_status,
    provider_request_id = p_provider_request_id,
    finished_at = now(),
    lease_expires_at = NULL,
    updated_at = now()
  WHERE id = p_run_id;

  SELECT * INTO v_target
  FROM prompt_execution_targets
  WHERE id = v_run.target_id;

  IF v_target.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE prompt_execution_targets
  SET
    latest_run_id = p_run_id,
    latest_answer_id = CASE
      WHEN p_prompt_answer_id IS NOT NULL THEN p_prompt_answer_id
      ELSE latest_answer_id
    END,
    latest_success_answer_id = CASE
      WHEN p_final_status = 'completed'::prompt_execution_run_status
        AND p_prompt_answer_id IS NOT NULL
      THEN p_prompt_answer_id
      ELSE latest_success_answer_id
    END,
    last_completed_at = now(),
    last_success_at = CASE
      WHEN p_final_status = 'completed'::prompt_execution_run_status
      THEN now()
      ELSE last_success_at
    END,
    last_due_at = CASE
      WHEN v_run.trigger_source = 'scheduled'::prompt_execution_trigger_source
      THEN v_run.scheduled_for
      ELSE last_due_at
    END,
    next_due_at = CASE
      WHEN v_run.trigger_source = 'scheduled'::prompt_execution_trigger_source
      THEN public.advance_prompt_due_to_future(
        public.compute_prompt_next_due(v_run.scheduled_for, v_target.cadence_unit, v_target.cadence_value),
        v_target.cadence_unit,
        v_target.cadence_value,
        now()
      )
      ELSE next_due_at
    END,
    updated_at = now()
  WHERE id = v_target.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.requeue_stale_prompt_execution_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH stale_runs AS (
    SELECT per.*
    FROM prompt_execution_runs per
    WHERE per.status IN (
      'dispatched'::prompt_execution_run_status,
      'processing'::prompt_execution_run_status
    )
      AND per.lease_expires_at IS NOT NULL
      AND per.lease_expires_at < now()
  )
  UPDATE prompt_execution_runs per
  SET
    status = CASE
      WHEN per.attempt_count < per.max_attempts THEN 'queued'::prompt_execution_run_status
      ELSE 'failed'::prompt_execution_run_status
    END,
    available_at = CASE
      WHEN per.attempt_count < per.max_attempts THEN now() + public.get_prompt_retry_backoff(per.attempt_count)
      ELSE per.available_at
    END,
    lease_expires_at = NULL,
    dispatch_token = NULL,
    finished_at = CASE
      WHEN per.attempt_count < per.max_attempts THEN per.finished_at
      ELSE now()
    END,
    error_class = COALESCE(per.error_class, 'lease_expired'),
    error_message = COALESCE(per.error_message, 'Execution lease expired before completion'),
    updated_at = now()
  FROM stale_runs
  WHERE per.id = stale_runs.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ── 7. History-based summaries and source RPC ───────────────

DROP VIEW IF EXISTS prompt_answer_sources_current;
DROP VIEW IF EXISTS prompt_answers_current;

DROP VIEW IF EXISTS prompts_summary;
CREATE OR REPLACE VIEW prompts_summary AS
SELECT
  p.id,
  p.tenant_id,
  p.topic_id,
  p.text,
  p.description,
  p.is_active,
  p.created_at,
  p.updated_at,
  COALESCE(pa_agg.answers, '[]'::jsonb) AS answers,
  COALESCE(pas_agg.sources, '[]'::jsonb) AS sources
FROM prompts p
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'platform_id', sub.platform_id,
      'platform_slug', sub.platform_slug,
      'model_id', sub.model_id,
      'model_slug', sub.model_slug,
      'count', sub.cnt
    )
  ) AS answers
  FROM (
    SELECT
      pa.platform_id,
      pa.platform_slug,
      pa.model_id,
      m.slug AS model_slug,
      COUNT(*)::int AS cnt
    FROM prompt_answers pa
    LEFT JOIN models m
      ON m.id = pa.model_id
    WHERE pa.prompt_id = p.id
      AND pa.deleted = false
    GROUP BY pa.platform_id, pa.platform_slug, pa.model_id, m.slug
  ) sub
) pa_agg ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'source_id', sub.source_id,
      'domain', sub.domain,
      'count', sub.cnt
    )
  ) AS sources
  FROM (
    SELECT
      pas.source_id,
      s.domain,
      COUNT(*)::int AS cnt
    FROM prompt_answer_sources pas
    JOIN prompt_answers pa
      ON pa.id = pas.answer_id
     AND pa.deleted = false
    LEFT JOIN sources s
      ON s.id = pas.source_id
    WHERE pas.prompt_id = p.id
    GROUP BY pas.source_id, s.domain
  ) sub
) pas_agg ON true;

ALTER VIEW prompts_summary SET (security_invoker = true);
REVOKE ALL ON prompts_summary FROM anon, public;
GRANT SELECT ON prompts_summary TO authenticated;

DROP FUNCTION IF EXISTS public.get_sources_summary(uuid);
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_sources ON sources;
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_pas ON prompt_answer_sources;
DROP TRIGGER IF EXISTS trg_refresh_sources_summary_on_pa ON prompt_answers;
DROP FUNCTION IF EXISTS public.refresh_sources_summary();
DROP MATERIALIZED VIEW IF EXISTS sources_summary;

CREATE OR REPLACE FUNCTION public.get_sources_summary(p_tenant_id uuid)
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
    SELECT *
    FROM (
      SELECT
        pas.tenant_id,
        pas.prompt_id,
        pas.answer_id,
        pas.source_id,
        p.text AS prompt_text,
        pa.platform_id,
        pa.platform_slug,
        pa.model_id,
        pl.name AS platform_name,
        m.name AS model_name,
        m.slug AS model_slug
      FROM prompt_answer_sources pas
      JOIN prompt_answers pa
        ON pa.id = pas.answer_id
       AND pa.deleted = false
      LEFT JOIN prompts p
        ON p.id = pas.prompt_id
      LEFT JOIN platforms pl
        ON pl.id = pa.platform_id
      LEFT JOIN models m
        ON m.id = pa.model_id
      WHERE pas.tenant_id = p_tenant_id
    ) tenant_pas_rows
  ),
  tenant_sources AS (
    SELECT DISTINCT source_id
    FROM tenant_pas
  )
  SELECT
    s.tenant_id,
    s.id,
    s.domain,
    COALESCE(total_agg.total, 0) AS total,
    COALESCE(by_prompt.total_by_prompt, '[]'::jsonb) AS total_by_prompt,
    COALESCE(by_answer.total_by_answer, '[]'::jsonb) AS total_by_answer,
    COALESCE(by_platform.total_by_platform, '[]'::jsonb) AS total_by_platform,
    COALESCE(by_model.total_by_model, '[]'::jsonb) AS total_by_model
  FROM sources s
  JOIN tenant_sources ts
    ON ts.source_id = s.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total
    FROM tenant_pas pas
    WHERE pas.source_id = s.id
  ) total_agg ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'prompt_id', sub.prompt_id,
        'prompt_text', sub.prompt_text,
        'count', sub.cnt
      )
    ) AS total_by_prompt
    FROM (
      SELECT pas.prompt_id, pas.prompt_text, COUNT(*)::int AS cnt
      FROM tenant_pas pas
      WHERE pas.source_id = s.id
      GROUP BY pas.prompt_id, pas.prompt_text
    ) sub
  ) by_prompt ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'answer_id', sub.answer_id,
        'count', sub.cnt
      )
    ) AS total_by_answer
    FROM (
      SELECT pas.answer_id, COUNT(*)::int AS cnt
      FROM tenant_pas pas
      WHERE pas.source_id = s.id
      GROUP BY pas.answer_id
    ) sub
  ) by_answer ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'platform_id', sub.platform_id,
        'platform_name', sub.platform_name,
        'platform_slug', sub.platform_slug,
        'count', sub.cnt
      )
    ) AS total_by_platform
    FROM (
      SELECT
        pas.platform_id,
        pl.name AS platform_name,
        pas.platform_slug,
        COUNT(*)::int AS cnt
      FROM tenant_pas pas
      LEFT JOIN platforms pl ON pl.id = pas.platform_id
      WHERE pas.source_id = s.id
      GROUP BY pas.platform_id, pl.name, pas.platform_slug
    ) sub
  ) by_platform ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'model_id', sub.model_id,
        'model_name', sub.model_name,
        'model_slug', sub.model_slug,
        'count', sub.cnt
      )
    ) AS total_by_model
    FROM (
      SELECT
        pas.model_id,
        pas.model_name,
        pas.model_slug,
        COUNT(*)::int AS cnt
      FROM tenant_pas pas
      WHERE pas.source_id = s.id
      GROUP BY pas.model_id, pas.model_name, pas.model_slug
    ) sub
  ) by_model ON true
  WHERE s.tenant_id = p_tenant_id;
$$;

-- ── 9. Internal function permissions ────────────────────────

REVOKE ALL ON FUNCTION public.get_setting_int(text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_setting_int(text, int)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_tenant_active_prompt_subscription(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_active_prompt_subscription(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.ensure_prompt_execution_target(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_prompt_execution_target(uuid, uuid, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_prompt_execution_targets()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_prompt_execution_targets()
  TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_due_prompt_execution_runs()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_due_prompt_execution_runs()
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_prompt_execution_runs(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_prompt_execution_runs(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.start_prompt_execution_run(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_prompt_execution_run(uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.finalize_prompt_execution_run(uuid, uuid, prompt_execution_run_status, text, text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_prompt_execution_run(uuid, uuid, prompt_execution_run_status, text, text, integer, text, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public.requeue_stale_prompt_execution_runs()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_prompt_execution_runs()
  TO service_role;

REVOKE ALL ON FUNCTION public.get_sources_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sources_summary(uuid)
  TO service_role;
