-- ============================================================
-- Migration: Drop get_sources_summary_full function
-- No longer needed — all callers (analyses-data, dashboard-overview,
-- insights) now query the views directly.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_sources_summary_full(uuid);
