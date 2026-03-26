-- Add sa_customizations JSONB column to profiles table for SA-specific UI preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sa_customizations JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.sa_customizations IS 'SA-specific UI customizations (kanban column order, collapsed state, etc.)';
