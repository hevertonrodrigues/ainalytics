-- Add is_default column to platforms table
ALTER TABLE platforms
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- Ensure only one platform can be the default at a time
CREATE UNIQUE INDEX idx_platforms_single_default
  ON platforms (is_default)
  WHERE is_default = true;
