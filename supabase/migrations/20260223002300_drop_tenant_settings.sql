-- Drop tenant_settings table and its RLS policies
DROP POLICY IF EXISTS "tenant_settings_select_same_tenant" ON tenant_settings;
DROP TABLE IF EXISTS tenant_settings;
