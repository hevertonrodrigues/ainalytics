-- ============================================================
-- Phase 4: Drop old DB functions — all callers removed
-- This runs AFTER the edge functions are deployed and verified.
-- ============================================================

-- AI Costs (5 functions)
DROP FUNCTION IF EXISTS public.get_ai_costs_summary(timestamptz);
DROP FUNCTION IF EXISTS public.get_ai_costs_by_tenant(timestamptz);
DROP FUNCTION IF EXISTS public.get_ai_costs_by_model(timestamptz);
DROP FUNCTION IF EXISTS public.get_ai_costs_by_callsite(timestamptz);
DROP FUNCTION IF EXISTS public.get_ai_costs_daily(timestamptz);

-- Admin Active Users
DROP FUNCTION IF EXISTS public.get_admin_active_users();

-- Admin Timeline (3 functions)
DROP FUNCTION IF EXISTS public.get_admin_tenants_list();
DROP FUNCTION IF EXISTS public.get_admin_timeline_grouped(timestamptz, text, uuid);
DROP FUNCTION IF EXISTS public.get_admin_timeline_answers(timestamptz, uuid, int, int);

-- Crawl progress (replaced by inline query)
DROP FUNCTION IF EXISTS public.get_crawl_progress(uuid);

-- NOTE: get_tenant_active_prompt_subscription(uuid) is NOT dropped here
-- because it is still called internally by ensure_prompt_execution_target()
-- (created in migration 20260307143000), which is invoked by prompt-search.

-- Monthly usage summary (zero callers)
DROP FUNCTION IF EXISTS public.get_monthly_usage_summary(uuid, int);

-- Sources summary full (replaced by views in prior session)
DROP FUNCTION IF EXISTS public.get_sources_summary_full(uuid);
