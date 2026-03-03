-- ── 4. RPC: get_crawl_progress (Updated) ────────────────────────────────
-- Returns crawl progress for an analysis.
-- Updated to include 'crawling' status in the 'pending' count,
-- preventing premature finalization of the analysis when crawling is ongoing.

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
    COUNT(*) FILTER (WHERE gap.status IN ('pending', 'crawling'))::INTEGER AS pending,
    COUNT(*) FILTER (WHERE gap.status = 'error')::INTEGER AS errors
  FROM geo_analyses_pages gap
  WHERE gap.analysis_id = p_analysis_id;
END;
$$;
