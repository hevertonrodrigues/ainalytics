-- Add has_seen_onboarding flag to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN NOT NULL DEFAULT false;
