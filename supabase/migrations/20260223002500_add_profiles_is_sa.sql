-- Add is_sa (SuperAdmin) column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_sa boolean NOT NULL DEFAULT false;

-- Nobody can update is_sa through the API — it can only be set via direct DB access
-- The existing RLS policies on profiles allow SELECT for same-tenant users,
-- but the column value is only meaningful for the user's own profile.
-- No additional RLS policy is needed since profiles already has tenant-scoped SELECT.
