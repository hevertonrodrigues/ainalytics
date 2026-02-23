-- ============================================================
-- Remove redundant `model` TEXT column from prompt_answers
-- model_id FK to models table is the canonical reference
-- ============================================================

ALTER TABLE prompt_answers DROP COLUMN IF EXISTS model;
