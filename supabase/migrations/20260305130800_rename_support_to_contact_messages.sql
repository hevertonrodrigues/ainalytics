-- Rename support_messages → contact_messages
ALTER TABLE support_messages RENAME TO contact_messages;

-- Rename indexes
ALTER INDEX IF EXISTS idx_support_messages_tenant_id RENAME TO idx_contact_messages_tenant_id;
ALTER INDEX IF EXISTS idx_support_messages_user_id RENAME TO idx_contact_messages_user_id;
ALTER INDEX IF EXISTS idx_support_messages_status RENAME TO idx_contact_messages_status;

-- Rename RLS policy
ALTER POLICY "support_messages_select_own_tenant" ON contact_messages
  RENAME TO "contact_messages_select_own_tenant";

-- Rename trigger
ALTER TRIGGER set_support_messages_updated_at ON contact_messages
  RENAME TO set_contact_messages_updated_at;
