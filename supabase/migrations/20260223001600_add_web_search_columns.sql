-- ============================================================
-- Add web search / citation columns to prompt_answers
-- ============================================================

-- Whether web search was enabled in the request
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS web_search_enabled BOOLEAN NOT NULL DEFAULT false;

-- Inline url_citation annotations: [{ start_index, end_index, title, url }]
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS annotations JSONB;

-- Deduplicated source URLs: [{ url, title }]  or "TBD" for unsupported platforms
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS sources JSONB;
