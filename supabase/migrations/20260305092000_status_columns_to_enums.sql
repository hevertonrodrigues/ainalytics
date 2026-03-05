-- Migration: Convert all text status columns to PostgreSQL enums
-- Affected tables: companies, geo_analyses, geo_analyses_pages,
--                  payment_attempts, prompt_execution_queue,
--                  subscriptions, support_messages

-- ═══════════════════════════════════════════════════════════════
-- 1. CREATE ENUM TYPES
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE llm_txt_status_enum AS ENUM ('missing', 'outdated', 'updated');
CREATE TYPE geo_analysis_status AS ENUM ('pending', 'scraping', 'scraping_done', 'analyzing', 'completed', 'error');
CREATE TYPE geo_analysis_page_status AS ENUM ('pending', 'crawling', 'completed', 'error');
CREATE TYPE payment_attempt_status AS ENUM ('succeeded', 'failed', 'pending', 'requires_action');
CREATE TYPE prompt_execution_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'incomplete_expired', 'paused', 'unpaid');
CREATE TYPE support_message_status AS ENUM ('new', 'in_progress', 'resolved', 'closed');


-- ═══════════════════════════════════════════════════════════════
-- 2. DROP CHECK CONSTRAINTS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_llm_txt_status_check;
ALTER TABLE geo_analyses DROP CONSTRAINT IF EXISTS geo_analyses_status_check;
ALTER TABLE geo_analyses_pages DROP CONSTRAINT IF EXISTS geo_analyses_pages_status_check;
ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_status_check;
ALTER TABLE prompt_execution_queue DROP CONSTRAINT IF EXISTS prompt_execution_queue_status_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
-- support_messages has no CHECK constraint


-- ═══════════════════════════════════════════════════════════════
-- 3. DROP PARTIAL INDEXES (they reference text values)
-- ═══════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_gap_status;
DROP INDEX IF EXISTS idx_peq_status;


-- ═══════════════════════════════════════════════════════════════
-- 4. CONVERT COLUMNS FROM TEXT TO ENUM
-- ═══════════════════════════════════════════════════════════════

-- companies.llm_txt_status
ALTER TABLE companies
  ALTER COLUMN llm_txt_status DROP DEFAULT,
  ALTER COLUMN llm_txt_status TYPE llm_txt_status_enum USING llm_txt_status::llm_txt_status_enum,
  ALTER COLUMN llm_txt_status SET DEFAULT 'missing';

-- geo_analyses.status
ALTER TABLE geo_analyses
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE geo_analysis_status USING status::geo_analysis_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- geo_analyses_pages.status
ALTER TABLE geo_analyses_pages
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE geo_analysis_page_status USING status::geo_analysis_page_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- payment_attempts.status
ALTER TABLE payment_attempts
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE payment_attempt_status USING status::payment_attempt_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- prompt_execution_queue.status
ALTER TABLE prompt_execution_queue
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE prompt_execution_status USING status::prompt_execution_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- subscriptions.status
ALTER TABLE subscriptions
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE subscription_status USING status::subscription_status,
  ALTER COLUMN status SET DEFAULT 'incomplete';

-- support_messages.status
ALTER TABLE support_messages
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE support_message_status USING status::support_message_status,
  ALTER COLUMN status SET DEFAULT 'new';


-- ═══════════════════════════════════════════════════════════════
-- 5. RECREATE PARTIAL INDEXES WITH ENUM VALUES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_gap_status
  ON geo_analyses_pages(status)
  WHERE status IN ('pending'::geo_analysis_page_status, 'crawling'::geo_analysis_page_status);

CREATE INDEX idx_peq_status
  ON prompt_execution_queue(status)
  WHERE status IN ('pending'::prompt_execution_status, 'processing'::prompt_execution_status);


-- ═══════════════════════════════════════════════════════════════
-- 6. RECREATE PL/pgSQL FUNCTIONS WITH ENUM-TYPED PARAMETERS
-- ═══════════════════════════════════════════════════════════════

-- ── checkout_crawl_pages ──
CREATE OR REPLACE FUNCTION public.checkout_crawl_pages(p_analysis_id uuid, p_batch_size integer DEFAULT 5)
 RETURNS TABLE(id uuid, url text, page_order integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH checked_out AS (
    SELECT gap.id
    FROM geo_analyses_pages gap
    WHERE gap.analysis_id = p_analysis_id
      AND gap.status = 'pending'::geo_analysis_page_status
    ORDER BY gap.page_order ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE geo_analyses_pages gap
  SET status = 'crawling'::geo_analysis_page_status,
      crawled_at = now()
  FROM checked_out
  WHERE gap.id = checked_out.id
  RETURNING gap.id, gap.url, gap.page_order;
END;
$function$;

-- ── checkout_prompt_executions ──
CREATE OR REPLACE FUNCTION public.checkout_prompt_executions(batch_size integer DEFAULT 5)
 RETURNS TABLE(id uuid, tenant_id uuid, prompt_id uuid, platform_id uuid, model_id uuid, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH checked_out AS (
    SELECT peq.id
    FROM prompt_execution_queue peq
    WHERE peq.status = 'pending'::prompt_execution_status
    ORDER BY peq.created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE prompt_execution_queue peq
  SET status = 'processing'::prompt_execution_status,
      started_at = now(),
      attempts = peq.attempts + 1,
      updated_at = now()
  FROM checked_out
  WHERE peq.id = checked_out.id
  RETURNING peq.id, peq.tenant_id, peq.prompt_id, peq.platform_id, peq.model_id, peq.attempts;
END;
$function$;

-- ── cleanup_prompt_execution_queue ──
CREATE OR REPLACE FUNCTION public.cleanup_prompt_execution_queue()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM prompt_execution_queue
  WHERE status IN ('completed'::prompt_execution_status, 'failed'::prompt_execution_status)
    AND completed_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

-- ── complete_crawl_page (parameter changed from text to geo_analysis_page_status) ──
CREATE OR REPLACE FUNCTION public.complete_crawl_page(
  p_page_id uuid,
  p_status geo_analysis_page_status,
  p_status_code integer DEFAULT NULL,
  p_load_time_ms integer DEFAULT NULL,
  p_redirect_chain jsonb DEFAULT NULL,
  p_page_data jsonb DEFAULT NULL,
  p_headless_data jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE geo_analyses_pages
  SET status = p_status,
      status_code = p_status_code,
      load_time_ms = p_load_time_ms,
      redirect_chain = p_redirect_chain,
      page_data = p_page_data,
      headless_data = p_headless_data,
      error_message = p_error_message,
      crawled_at = now()
  WHERE id = p_page_id;
END;
$function$;

-- ── complete_prompt_execution (parameter changed from text to prompt_execution_status) ──
CREATE OR REPLACE FUNCTION public.complete_prompt_execution(
  p_queue_id uuid,
  p_status prompt_execution_status,
  p_error_message text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE prompt_execution_queue
  SET status = p_status,
      error_message = p_error_message,
      completed_at = CASE WHEN p_status IN ('completed'::prompt_execution_status, 'failed'::prompt_execution_status) THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = p_queue_id;
END;
$function$;

-- ── enqueue_hourly_prompts ──
CREATE OR REPLACE FUNCTION public.enqueue_hourly_prompts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant RECORD;
  v_total_enqueued INTEGER := 0;
  v_tenant_count INTEGER := 0;
BEGIN
  FOR v_tenant IN
    SELECT t.id AS tenant_id, t.prompt_executions_per_hour
    FROM tenants t
    WHERE EXISTS (
      SELECT 1 FROM tenant_platform_models tpm
      WHERE tpm.tenant_id = t.id AND tpm.is_active = true
    )
  LOOP
    INSERT INTO prompt_execution_queue (tenant_id, prompt_id, platform_id, model_id, status)
    SELECT
      v_tenant.tenant_id,
      p.id,
      tpm.platform_id,
      tpm.model_id,
      'pending'::prompt_execution_status
    FROM prompts p
    CROSS JOIN tenant_platform_models tpm
    CROSS JOIN generate_series(1, v_tenant.prompt_executions_per_hour) AS rep(n)
    WHERE p.tenant_id = v_tenant.tenant_id
      AND p.is_active = true
      AND tpm.tenant_id = v_tenant.tenant_id
      AND tpm.is_active = true;

    v_total_enqueued := v_total_enqueued + (
      SELECT count(*)::int FROM prompts p
      CROSS JOIN tenant_platform_models tpm
      WHERE p.tenant_id = v_tenant.tenant_id
        AND p.is_active = true
        AND tpm.tenant_id = v_tenant.tenant_id
        AND tpm.is_active = true
    ) * v_tenant.prompt_executions_per_hour;

    v_tenant_count := v_tenant_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'tenants_processed', v_tenant_count,
    'total_enqueued', v_total_enqueued,
    'enqueued_at', now()
  );
END;
$function$;

-- ── get_crawl_progress ──
CREATE OR REPLACE FUNCTION public.get_crawl_progress(p_analysis_id uuid)
 RETURNS TABLE(total integer, completed integer, pending integer, errors integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE gap.status = 'completed'::geo_analysis_page_status)::INTEGER AS completed,
    COUNT(*) FILTER (WHERE gap.status IN ('pending'::geo_analysis_page_status, 'crawling'::geo_analysis_page_status))::INTEGER AS pending,
    COUNT(*) FILTER (WHERE gap.status = 'error'::geo_analysis_page_status)::INTEGER AS errors
  FROM geo_analyses_pages gap
  WHERE gap.analysis_id = p_analysis_id;
END;
$function$;

-- ── invoke_crawl_pages_worker ──
CREATE OR REPLACE FUNCTION public.invoke_crawl_pages_worker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_anon_key TEXT;
  v_has_work BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM geo_analyses WHERE status = 'scraping'::geo_analysis_status LIMIT 1
  ) INTO v_has_work;

  IF NOT v_has_work THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'cron_supabase_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
  SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'cron_anon_key';

  IF v_url IS NOT NULL AND v_secret IS NOT NULL AND v_anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/crawl-pages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'x-cron-secret', v_secret
      ),
      body := '{}'::jsonb
    );
  ELSE
    RAISE WARNING 'invoke_crawl_pages_worker: Missing vault secrets';
  END IF;
END;
$function$;

-- ── prevent_plan_delete_with_active_subscriptions ──
CREATE OR REPLACE FUNCTION public.prevent_plan_delete_with_active_subscriptions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE plan_id = OLD.id
      AND status IN ('active'::subscription_status, 'past_due'::subscription_status, 'trialing'::subscription_status)
  ) THEN
    RAISE EXCEPTION 'Cannot delete plan with active subscriptions';
  END IF;
  RETURN OLD;
END;
$function$;

-- ── prevent_tenant_delete_with_active_subscriptions ──
CREATE OR REPLACE FUNCTION public.prevent_tenant_delete_with_active_subscriptions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE tenant_id = OLD.id
      AND status IN ('active'::subscription_status, 'past_due'::subscription_status, 'trialing'::subscription_status)
  ) THEN
    RAISE EXCEPTION 'Cannot delete tenant with active subscriptions';
  END IF;
  RETURN OLD;
END;
$function$;

-- ── reset_stuck_prompt_executions ──
CREATE OR REPLACE FUNCTION public.reset_stuck_prompt_executions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reset INTEGER;
BEGIN
  UPDATE prompt_execution_queue
  SET status = 'pending'::prompt_execution_status,
      started_at = NULL,
      updated_at = now()
  WHERE status = 'processing'::prompt_execution_status
    AND started_at < now() - INTERVAL '5 minutes';
  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN v_reset;
END;
$function$;
