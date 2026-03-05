-- Function to reset pages stuck in 'crawling' status back to 'pending'.
-- This handles the case where the crawl-pages edge function is terminated
-- early (wall clock limit) before completing page processing.
CREATE OR REPLACE FUNCTION public.reset_stale_crawling_pages(p_stale_minutes integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reset_count integer;
BEGIN
  WITH stale AS (
    SELECT gap.id
    FROM geo_analyses_pages gap
    WHERE gap.status = 'crawling'::geo_analysis_page_status
      AND gap.crawled_at < now() - (p_stale_minutes || ' minutes')::interval
  )
  UPDATE geo_analyses_pages gap
  SET status = 'pending'::geo_analysis_page_status,
      crawled_at = NULL
  FROM stale
  WHERE gap.id = stale.id;

  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$function$;
