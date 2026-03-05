-- Drop the welcome modal flag column and its index from profiles
-- The welcome content has been moved to the onboarding first step (WelcomeStep)

-- Drop the index first
DROP INDEX IF EXISTS idx_profiles_welcome_modal;

-- Drop the column
ALTER TABLE profiles DROP COLUMN IF EXISTS has_seen_welcome_modal;
