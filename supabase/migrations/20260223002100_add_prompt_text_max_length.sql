-- ============================================================
-- Migration: Add max length constraint to prompts.text (500 chars)
-- ============================================================

ALTER TABLE prompts ADD CONSTRAINT prompts_text_max_length CHECK (char_length(text) <= 500);
