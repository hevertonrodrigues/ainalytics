-- Drop the text-overload of complete_crawl_page that conflicts with the enum version.
-- The edge function passes p_status as a string (e.g. "completed"), which PostgREST
-- resolves to the text overload. But the column is geo_analysis_page_status (enum),
-- causing a silent type mismatch where the UPDATE is a no-op.
-- Solution: keep only a TEXT version that explicitly casts to enum inside the function.

-- Drop both overloads
DROP FUNCTION IF EXISTS public.complete_crawl_page(uuid, text, integer, integer, jsonb, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.complete_crawl_page(uuid, geo_analysis_page_status, integer, integer, jsonb, jsonb, jsonb, text);

-- Recreate with text parameter that casts to enum internally
CREATE OR REPLACE FUNCTION public.complete_crawl_page(
  p_page_id uuid,
  p_status text,
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
  SET status = p_status::geo_analysis_page_status,
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
