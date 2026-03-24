-- Add sitemap_xml column to companies table.
-- This column is used by the get-website-information edge function
-- to store the fetched/uploaded sitemap alongside other extracted data.
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS sitemap_xml text;

-- Backfill: copy sitemap_xml from the latest geo_analysis for each company
UPDATE public.companies c
SET sitemap_xml = ga.sitemap_xml
FROM (
  SELECT DISTINCT ON (company_id) company_id, sitemap_xml
  FROM public.geo_analyses
  WHERE sitemap_xml IS NOT NULL
  ORDER BY company_id, created_at DESC
) ga
WHERE c.id = ga.company_id
  AND c.sitemap_xml IS NULL;
