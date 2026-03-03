-- ============================================================
-- Migration: geo_analyses_pages table + RPCs + cron schedule
-- ============================================================
-- Stores individual page crawl results for background processing.
-- Each URL discovered during homepage analysis gets its own row.

-- ── 1. Create geo_analyses_pages table ────────────────────────

CREATE TABLE geo_analyses_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID NOT NULL REFERENCES geo_analyses(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'crawling', 'completed', 'error')),
  page_order      INTEGER NOT NULL DEFAULT 0,
  status_code     INTEGER,
  load_time_ms    INTEGER,
  redirect_chain  JSONB,
  page_data       JSONB,       -- Full extracted page data (headings, content, schema, etc.)
  headless_data   JSONB,       -- Browserless SSR/mobile data
  links           JSONB,       -- {internal: string[], external: string[]} found on page
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  crawled_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_gap_analysis_id ON geo_analyses_pages(analysis_id);
CREATE INDEX idx_gap_status ON geo_analyses_pages(status) WHERE status IN ('pending', 'crawling');
CREATE INDEX idx_gap_analysis_order ON geo_analyses_pages(analysis_id, page_order);

-- RLS
ALTER TABLE geo_analyses_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gap_select" ON geo_analyses_pages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM geo_analyses ga
      JOIN tenant_companies tc ON tc.company_id = ga.company_id
      JOIN tenant_users tu ON tu.tenant_id = tc.tenant_id
      WHERE ga.id = geo_analyses_pages.analysis_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- ── 2. RPC: checkout_crawl_pages ──────────────────────────────
-- Atomically claims the next N pending pages for a given analysis.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions.

CREATE OR REPLACE FUNCTION checkout_crawl_pages(
  p_analysis_id UUID,
  p_batch_size INTEGER DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  url         TEXT,
  page_order  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH checked_out AS (
    SELECT gap.id
    FROM geo_analyses_pages gap
    WHERE gap.analysis_id = p_analysis_id
      AND gap.status = 'pending'
    ORDER BY gap.page_order ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE geo_analyses_pages gap
  SET status = 'crawling',
      crawled_at = now()
  FROM checked_out
  WHERE gap.id = checked_out.id
  RETURNING gap.id, gap.url, gap.page_order;
END;
$$;

-- ── 3. RPC: complete_crawl_page ───────────────────────────────
-- Marks a page as completed or error with its data.

CREATE OR REPLACE FUNCTION complete_crawl_page(
  p_page_id UUID,
  p_status TEXT,
  p_status_code INTEGER DEFAULT NULL,
  p_load_time_ms INTEGER DEFAULT NULL,
  p_redirect_chain JSONB DEFAULT NULL,
  p_page_data JSONB DEFAULT NULL,
  p_headless_data JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ── 4. RPC: get_crawl_progress ────────────────────────────────
-- Returns crawl progress for an analysis.

CREATE OR REPLACE FUNCTION get_crawl_progress(p_analysis_id UUID)
RETURNS TABLE (
  total       INTEGER,
  completed   INTEGER,
  pending     INTEGER,
  errors      INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE gap.status = 'completed')::INTEGER AS completed,
    COUNT(*) FILTER (WHERE gap.status = 'pending')::INTEGER AS pending,
    COUNT(*) FILTER (WHERE gap.status = 'error')::INTEGER AS errors
  FROM geo_analyses_pages gap
  WHERE gap.analysis_id = p_analysis_id;
END;
$$;

-- ── 5. Helper: invoke_crawl_pages_worker ──────────────────────
-- Called by pg_cron. Uses vault secrets to POST to the edge function.

CREATE OR REPLACE FUNCTION invoke_crawl_pages_worker()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_anon_key TEXT;
  v_has_work BOOLEAN;
BEGIN
  -- Only invoke if there's actual work to do
  SELECT EXISTS (
    SELECT 1 FROM geo_analyses WHERE status = 'scraping' LIMIT 1
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
$$;

-- ── 6. Schedule: every 1 minute ───────────────────────────────
SELECT cron.schedule(
  'invoke-crawl-pages-worker',
  '* * * * *',    -- every minute
  $$SELECT invoke_crawl_pages_worker()$$
);
