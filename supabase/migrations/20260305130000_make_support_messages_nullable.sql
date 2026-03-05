-- Make tenant_id and user_id nullable so public contact form
-- can insert rows without authentication
ALTER TABLE support_messages ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE support_messages ALTER COLUMN user_id DROP NOT NULL;
