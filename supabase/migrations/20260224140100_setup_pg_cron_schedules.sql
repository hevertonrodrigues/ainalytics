-- ============================================================
-- Migration: pg_cron schedules for background prompt execution
-- ============================================================
-- Requires pg_cron and pg_net extensions (available on Supabase hosted).
-- NOTE: For local development, these schedules won't run.
--       You can test by manually calling the RPCs and the Edge Function.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. Hourly: enqueue prompt executions ─────────────────────
-- Runs at the start of every hour. Populates the queue for all
-- active tenants based on their prompt_executions_per_hour setting.
SELECT cron.schedule(
  'enqueue-hourly-prompts',        -- job name
  '0 * * * *',                     -- every hour at minute 0
  $$SELECT enqueue_hourly_prompts()$$
);

-- ── Helper Function to Invoke Worker ─────────────────────────
-- We use a wrapper function because pg_cron cannot directly read from vault
-- inside the cron.schedule() string literal effectively for every run.
CREATE OR REPLACE FUNCTION invoke_prompt_search_worker()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_anon_key TEXT;
BEGIN
  -- Read from Supabase Vault
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'cron_supabase_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'cron_anon_key';

  IF v_url IS NOT NULL AND v_secret IS NOT NULL AND v_anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/prompt-search-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'x-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );
  ELSE
    RAISE WARNING 'invoke_prompt_search_worker: Missing vault secrets (cron_supabase_url, cron_secret, cron_anon_key)';
  END IF;
END;
$$;

-- ── 2. Every 10 minutes: invoke the worker Edge Function ───────
-- Uses pg_net to make an HTTP POST to the worker Edge Function.
-- The CRON_SECRET is used for authentication via the Vault.
SELECT cron.schedule(
  'invoke-prompt-search-worker',   -- job name
  '*/10 * * * *',                  -- every 10 minutes
  $$SELECT invoke_prompt_search_worker()$$
);

-- ── 3. Daily cleanup: remove old completed/failed entries ────
-- Runs daily at 3 AM to clean up queue entries older than 7 days.
SELECT cron.schedule(
  'cleanup-prompt-execution-queue', -- job name
  '0 3 * * *',                      -- daily at 3:00 AM
  $$SELECT cleanup_prompt_execution_queue()$$
);
