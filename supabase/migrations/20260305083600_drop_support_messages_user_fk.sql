-- Drop the FK constraint on user_id since auth user IDs
-- may not exist in the profiles table at insert time.
ALTER TABLE support_messages
  DROP CONSTRAINT IF EXISTS support_messages_user_id_fkey;
