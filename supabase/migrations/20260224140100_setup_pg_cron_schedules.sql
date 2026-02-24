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

-- ── 2. Every minute: invoke the worker Edge Function ─────────
-- Uses pg_net to make an HTTP POST to the worker Edge Function.
-- The CRON_SECRET is used for authentication.
SELECT cron.schedule(
  'invoke-prompt-search-worker',   -- job name
  '* * * * *',                     -- every minute
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/prompt-search-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── 3. Daily cleanup: remove old completed/failed entries ────
-- Runs daily at 3 AM to clean up queue entries older than 7 days.
SELECT cron.schedule(
  'cleanup-prompt-execution-queue', -- job name
  '0 3 * * *',                      -- daily at 3:00 AM
  $$SELECT cleanup_prompt_execution_queue()$$
);
