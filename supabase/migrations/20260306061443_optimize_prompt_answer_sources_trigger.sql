-- Optimize process_prompt_answer_sources() from row-by-row loops to batch operations.
-- Before: up to 208 individual DML statements per insert (P99 = 112).
-- After:  exactly 2 bulk DML statements regardless of source count.
--
-- Also drops the unused idx_prompt_answer_sources_tenant_id index (only 25 scans
-- vs 7.9M for source_id). It slows every insert without query benefit.

-- 1. Drop unused index
DROP INDEX IF EXISTS idx_prompt_answer_sources_tenant_id;

-- 2. Rewrite trigger function with batch operations
CREATE OR REPLACE FUNCTION public.process_prompt_answer_sources()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout = '120s'
AS $function$
DECLARE
  anno_urls TEXT[];
BEGIN
  -- Skip if no annotations and no sources
  IF (NEW.annotations IS NULL OR jsonb_typeof(NEW.annotations) != 'array')
     AND (NEW.sources IS NULL OR jsonb_typeof(NEW.sources) != 'array') THEN
    RETURN NEW;
  END IF;

  -- Collect annotation URLs for deduplication against sources
  SELECT array_agg(a->>'url')
    INTO anno_urls
    FROM jsonb_array_elements(COALESCE(NEW.annotations, '[]'::jsonb)) AS a
   WHERE a->>'url' IS NOT NULL;
  anno_urls := COALESCE(anno_urls, '{}');

  -- Step 1: Batch upsert unique domains into sources (single DML).
  -- DISTINCT ON (domain) avoids "ON CONFLICT cannot affect row a second time"
  -- when multiple URLs map to the same domain.
  INSERT INTO sources (tenant_id, name, domain)
  SELECT DISTINCT ON (domain)
    NEW.tenant_id, title, domain
  FROM (
    SELECT anno->>'url' AS url, anno->>'title' AS title, extract_base_domain(anno->>'url') AS domain
      FROM jsonb_array_elements(COALESCE(NEW.annotations, '[]'::jsonb)) AS anno
     WHERE anno->>'url' IS NOT NULL
    UNION ALL
    SELECT src->>'url', src->>'title', extract_base_domain(src->>'url')
      FROM jsonb_array_elements(COALESCE(NEW.sources, '[]'::jsonb)) AS src
     WHERE src->>'url' IS NOT NULL
  ) combined
  ON CONFLICT (tenant_id, domain)
  DO UPDATE SET name = COALESCE(sources.name, EXCLUDED.name), updated_at = now();

  -- Step 2: Batch insert prompt_answer_sources (single DML).
  -- All annotations (possibly multiple per URL with different text spans),
  -- plus sources whose URL was not already covered by an annotation.
  INSERT INTO prompt_answer_sources (
    tenant_id, prompt_id, answer_id, source_id, url, title, annotation
  )
  SELECT
    NEW.tenant_id,
    NEW.prompt_id,
    NEW.id,
    s.id,
    combined.url,
    combined.title,
    combined.annotation_text
  FROM (
    -- All annotations (keep duplicates — same URL can cite different text spans)
    SELECT
      anno->>'url' AS url,
      anno->>'title' AS title,
      CASE
        WHEN (anno->>'start_index') IS NOT NULL
         AND (anno->>'end_index') IS NOT NULL
         AND NEW.answer_text IS NOT NULL
        THEN substring(NEW.answer_text
               FROM ((anno->>'start_index')::int + 1)
               FOR  ((anno->>'end_index')::int - (anno->>'start_index')::int))
        ELSE NULL
      END AS annotation_text
    FROM jsonb_array_elements(COALESCE(NEW.annotations, '[]'::jsonb)) AS anno
    WHERE anno->>'url' IS NOT NULL

    UNION ALL

    -- Sources not already covered by annotations
    SELECT
      src->>'url',
      src->>'title',
      NULL
    FROM jsonb_array_elements(COALESCE(NEW.sources, '[]'::jsonb)) AS src
    WHERE src->>'url' IS NOT NULL
      AND NOT (src->>'url' = ANY(anno_urls))
  ) combined
  JOIN sources s
    ON s.tenant_id = NEW.tenant_id
   AND s.domain = extract_base_domain(combined.url);

  RETURN NEW;
END;
$function$;
