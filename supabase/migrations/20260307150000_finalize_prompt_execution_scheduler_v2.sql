-- ============================================================
-- Prompt execution scheduler v2 cutover
-- Finalize cron dispatch, remove the legacy queue path, and
-- schedule the new lease-based worker loop.
-- ============================================================

CREATE OR REPLACE FUNCTION public.dispatch_prompt_execution_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, vault
AS $$
DECLARE
  hard_limit CONSTANT integer := 50;
  v_url text;
  v_secret text;
  v_anon_key text;
  v_limit integer;
  v_run record;
  v_count integer := 0;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'cron_supabase_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret';

  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'cron_anon_key';

  IF v_url IS NULL OR v_secret IS NULL OR v_anon_key IS NULL THEN
    RAISE WARNING 'dispatch_prompt_execution_runs: Missing vault secrets (cron_supabase_url, cron_secret, cron_anon_key)';
    RETURN 0;
  END IF;

  v_limit := LEAST(
    public.get_setting_int('PROMPT_EXECUTION_DISPATCH_LIMIT', 10),
    hard_limit
  );

  FOR v_run IN
    SELECT *
    FROM public.claim_prompt_execution_runs(v_limit)
  LOOP
    PERFORM net.http_post(
      url := v_url || '/functions/v1/prompt-execution-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object(
        'run_id', v_run.id,
        'dispatch_token', v_run.dispatch_token
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_prompt_execution_scheduler_cycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, vault
AS $$
DECLARE
  v_reconciled integer := 0;
  v_requeued integer := 0;
  v_enqueued integer := 0;
  v_dispatched integer := 0;
BEGIN
  v_reconciled := public.reconcile_prompt_execution_targets();
  v_requeued := public.requeue_stale_prompt_execution_runs();
  v_enqueued := public.enqueue_due_prompt_execution_runs();
  v_dispatched := public.dispatch_prompt_execution_runs();

  RETURN jsonb_build_object(
    'reconciled', v_reconciled,
    'requeued', v_requeued,
    'enqueued', v_enqueued,
    'dispatched', v_dispatched,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_prompt_execution_runs()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_prompt_execution_runs()
  TO service_role;

REVOKE ALL ON FUNCTION public.run_prompt_execution_scheduler_cycle()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_prompt_execution_scheduler_cycle()
  TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'enqueue-hourly-prompts',
      'invoke-prompt-search-worker',
      'cleanup-prompt-execution-queue',
      'prompt-execution-cycle'
    )
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'prompt-execution-cycle'
  ) THEN
    PERFORM cron.schedule(
      'prompt-execution-cycle',
      '* * * * *',
      $cron$SELECT public.run_prompt_execution_scheduler_cycle()$cron$
    );
  END IF;
END;
$$;

DELETE FROM general_settings
WHERE key IN ('PROMPT_JOBS_PER_CYCLE', 'PROMPT_MAX_ATTEMPTS');

DROP FUNCTION IF EXISTS public.checkout_prompt_executions(integer);
DROP FUNCTION IF EXISTS public.complete_prompt_execution(uuid, text, text);
DROP FUNCTION IF EXISTS public.complete_prompt_execution(uuid, prompt_execution_status, text);
DROP FUNCTION IF EXISTS public.cleanup_prompt_execution_queue();
DROP FUNCTION IF EXISTS public.enqueue_hourly_prompts();
DROP FUNCTION IF EXISTS public.invoke_prompt_search_worker();
DROP FUNCTION IF EXISTS public.update_tenant_prompt_executions(uuid, integer);

DROP TABLE IF EXISTS prompt_execution_queue;
ALTER TABLE tenants DROP COLUMN IF EXISTS prompt_executions_per_hour;

DROP TYPE IF EXISTS prompt_execution_status;
