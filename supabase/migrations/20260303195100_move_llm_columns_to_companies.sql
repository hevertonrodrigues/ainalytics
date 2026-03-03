-- Migration: Move LLM-related columns from tenants to companies
-- Companies already has: website_title, sitemap_xml
-- Need to add: metatags, extracted_content, llm_txt, llm_txt_status

-- Step 1: Add missing columns to companies
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS metatags TEXT,
ADD COLUMN IF NOT EXISTS extracted_content TEXT,
ADD COLUMN IF NOT EXISTS llm_txt TEXT,
ADD COLUMN IF NOT EXISTS llm_txt_status TEXT DEFAULT 'missing'::text
  CHECK (llm_txt_status IN ('missing', 'outdated', 'updated'));

-- Step 2: Drop columns from tenants
ALTER TABLE tenants
DROP COLUMN IF EXISTS website_title,
DROP COLUMN IF EXISTS metatags,
DROP COLUMN IF EXISTS extracted_content,
DROP COLUMN IF EXISTS llm_txt,
DROP COLUMN IF EXISTS sitemap_xml,
DROP COLUMN IF EXISTS llm_txt_status;
