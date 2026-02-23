-- ============================================================
-- Add web_search_active flag to models table
-- Controls whether AI adapters attempt web search for the model
-- ============================================================

ALTER TABLE models ADD COLUMN web_search_active BOOLEAN NOT NULL DEFAULT false;
