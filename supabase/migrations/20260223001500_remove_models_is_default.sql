-- ============================================================
-- Migration: Remove is_default from models
-- ============================================================

-- 1. Ensure platforms default_model_id is populated for existing rows before dropping the column.
-- (This was already being handled by previous logic, but just in case)
UPDATE platforms 
SET default_model_id = (SELECT id FROM models WHERE platform_id = platforms.id AND is_default = true LIMIT 1)
WHERE default_model_id IS NULL;

-- 2. Drop the redundant column from models
ALTER TABLE models DROP COLUMN IF EXISTS is_default;
