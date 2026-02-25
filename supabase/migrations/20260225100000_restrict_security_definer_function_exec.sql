-- ============================================================
-- Restrict EXECUTE on SECURITY DEFINER functions
-- ============================================================
-- Goal:
-- 1) Internal queue/cron helper functions => service_role only
-- 2) Tenant-facing SECURITY DEFINER RPCs => authenticated only
-- 3) Stop relying on default PUBLIC EXECUTE privileges

-- ── Internal queue/cron functions (service_role only) ───────

REVOKE ALL ON FUNCTION public.enqueue_hourly_prompts()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_hourly_prompts()
  TO service_role;

REVOKE ALL ON FUNCTION public.checkout_prompt_executions(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_prompt_executions(integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.complete_prompt_execution(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_prompt_execution(uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_prompt_execution_queue()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_prompt_execution_queue()
  TO service_role;

REVOKE ALL ON FUNCTION public.reset_stuck_prompt_executions()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stuck_prompt_executions()
  TO service_role;

REVOKE ALL ON FUNCTION public.invoke_prompt_search_worker()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_prompt_search_worker()
  TO service_role;

-- ── Tenant-facing SECURITY DEFINER RPCs (authenticated only) ──

REVOKE ALL ON FUNCTION public.update_tenant_domain(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_domain(uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.update_tenant_prompt_executions(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_prompt_executions(uuid, integer)
  TO authenticated;

