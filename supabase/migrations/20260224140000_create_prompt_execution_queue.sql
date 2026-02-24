-- ============================================================
-- Migration: Background prompt execution queue system
-- ============================================================

-- ── 1. Add prompt_executions_per_hour to tenants ──────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS prompt_executions_per_hour INTEGER NOT NULL DEFAULT 1;

-- ── 2. Create prompt_execution_queue table ─────────────────
CREATE TABLE IF NOT EXISTS prompt_execution_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  model_id        UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message   TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_peq_tenant_id ON prompt_execution_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_peq_status ON prompt_execution_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_peq_prompt_id ON prompt_execution_queue(prompt_id);
CREATE INDEX IF NOT EXISTS idx_peq_created_at ON prompt_execution_queue(created_at DESC);

-- RLS
ALTER TABLE prompt_execution_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "peq_select_own_tenant"
  ON prompt_execution_queue FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );

-- Mutations via Edge Functions (service_role bypasses RLS)

-- Updated_at trigger
CREATE TRIGGER set_peq_updated_at
  BEFORE UPDATE ON prompt_execution_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── 3. RPC: enqueue_hourly_prompts ─────────────────────────
-- Called by pg_cron every hour. For each active tenant, inserts
-- (prompt × active_model × executions_per_hour) rows into the queue.
CREATE OR REPLACE FUNCTION enqueue_hourly_prompts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_total_enqueued INTEGER := 0;
  v_tenant_count INTEGER := 0;
BEGIN
  FOR v_tenant IN
    SELECT t.id AS tenant_id, t.prompt_executions_per_hour
    FROM tenants t
    -- Only enqueue for tenants that have at least one active model
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
      'pending'
    FROM prompts p
    CROSS JOIN tenant_platform_models tpm
    -- Generate N copies per prompt_executions_per_hour
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
$$;

-- ── 4. RPC: checkout_prompt_executions ─────────────────────
-- Atomically marks N 'pending' items as 'processing' and returns them.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions.
CREATE OR REPLACE FUNCTION checkout_prompt_executions(batch_size INTEGER DEFAULT 5)
RETURNS TABLE (
  id              UUID,
  tenant_id       UUID,
  prompt_id       UUID,
  platform_id     UUID,
  model_id        UUID,
  attempts        INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH checked_out AS (
    SELECT peq.id
    FROM prompt_execution_queue peq
    WHERE peq.status = 'pending'
    ORDER BY peq.created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE prompt_execution_queue peq
  SET status = 'processing',
      started_at = now(),
      attempts = peq.attempts + 1,
      updated_at = now()
  FROM checked_out
  WHERE peq.id = checked_out.id
  RETURNING peq.id, peq.tenant_id, peq.prompt_id, peq.platform_id, peq.model_id, peq.attempts;
END;
$$;

-- ── 5. RPC: complete_prompt_execution ──────────────────────
-- Marks a queue item as completed or failed.
CREATE OR REPLACE FUNCTION complete_prompt_execution(
  p_queue_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE prompt_execution_queue
  SET status = p_status,
      error_message = p_error_message,
      completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = p_queue_id;
END;
$$;

-- ── 6. Cleanup old completed/failed queue entries ──────────
-- Deletes queue entries older than 7 days to keep the table lean.
CREATE OR REPLACE FUNCTION cleanup_prompt_execution_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM prompt_execution_queue
  WHERE status IN ('completed', 'failed')
    AND completed_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ── 7. Reset stuck processing jobs ─────────────────────────
-- If a job has been 'processing' for more than 5 minutes, reset it to 'pending'.
CREATE OR REPLACE FUNCTION reset_stuck_prompt_executions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset INTEGER;
BEGIN
  UPDATE prompt_execution_queue
  SET status = 'pending',
      started_at = NULL,
      updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - INTERVAL '5 minutes';
  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN v_reset;
END;
$$;

-- ── 8. RPC: update_tenant_prompt_executions ────────────────
-- Allows admins/owners to safely update the background execution rate
CREATE OR REPLACE FUNCTION update_tenant_prompt_executions(
  p_tenant_id UUID,
  p_executions INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check authorization
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users 
    WHERE tenant_id = p_tenant_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE tenants
  SET prompt_executions_per_hour = p_executions,
      updated_at = NOW()
  WHERE id = p_tenant_id;
END;
$$;
