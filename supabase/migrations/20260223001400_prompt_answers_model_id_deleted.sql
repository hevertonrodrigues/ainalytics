-- ============================================================
-- Refactor prompt_answers: model_id FK, deleted flag
-- ============================================================

-- 1. Add model_id FK column (nullable for existing rows)
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES models(id);

-- 2. Add deleted flag
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- 3. Index on deleted for filtering
CREATE INDEX IF NOT EXISTS idx_prompt_answers_deleted ON prompt_answers (deleted) WHERE deleted = false;
