-- Migration: Add welcome modal flag to profiles

ALTER TABLE profiles
ADD COLUMN has_seen_welcome_modal BOOLEAN NOT NULL DEFAULT false;

-- Add an index since we might query on this for analytics eventually
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_modal ON profiles(has_seen_welcome_modal);
