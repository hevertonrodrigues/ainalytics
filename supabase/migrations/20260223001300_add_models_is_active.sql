-- Add is_active flag to models table
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
