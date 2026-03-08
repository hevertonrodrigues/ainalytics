-- ============================================================
-- 10x prompt execution runs per scheduled cycle
-- Instead of creating 1 run per due target, create 10 runs
-- so each frequency trigger produces 10 prompt answers per model.
-- ============================================================

-- ── 1. Replace unique index with non-unique ─────────────────
-- The old unique index prevented more than 1 active run per target.
-- We need multiple concurrent runs now.

DROP INDEX IF EXISTS idx_prompt_execution_runs_active_target;

CREATE INDEX IF NOT EXISTS idx_prompt_execution_runs_active_target
  ON prompt_execution_runs(target_id)
  WHERE status IN (
    'queued'::prompt_execution_run_status,
    'dispatched'::prompt_execution_run_status,
    'processing'::prompt_execution_run_status
  );

-- ── 2. Enqueue 10 runs per due target ───────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_due_prompt_execution_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_inserted integer := 0;
  v_max_attempts integer := public.get_setting_int('PROMPT_EXECUTION_MAX_ATTEMPTS', 3);
  v_runs_per_cycle CONSTANT integer := 10;
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
  FROM due_targets
  CROSS JOIN generate_series(1, v_runs_per_cycle);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ── 3. Finalize: only advance next_due_at when all batch siblings are done ──

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
  v_siblings_pending integer;
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

  -- Count sibling runs from the same batch that are still active
  SELECT COUNT(*) INTO v_siblings_pending
  FROM prompt_execution_runs
  WHERE target_id = v_run.target_id
    AND scheduled_for = v_run.scheduled_for
    AND id <> p_run_id
    AND status IN (
      'queued'::prompt_execution_run_status,
      'dispatched'::prompt_execution_run_status,
      'processing'::prompt_execution_run_status
    );

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
    last_completed_at = CASE
      WHEN v_siblings_pending = 0 THEN now()
      ELSE last_completed_at
    END,
    last_success_at = CASE
      WHEN p_final_status = 'completed'::prompt_execution_run_status
      THEN now()
      ELSE last_success_at
    END,
    last_due_at = CASE
      WHEN v_run.trigger_source = 'scheduled'::prompt_execution_trigger_source
        AND v_siblings_pending = 0
      THEN v_run.scheduled_for
      ELSE last_due_at
    END,
    next_due_at = CASE
      WHEN v_run.trigger_source = 'scheduled'::prompt_execution_trigger_source
        AND v_siblings_pending = 0
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
