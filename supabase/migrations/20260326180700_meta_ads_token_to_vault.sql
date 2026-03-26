-- ============================================================
-- Migration: Move Meta Ads access_token to Supabase Vault
-- Replaces plaintext storage with encrypted Vault secret
-- ============================================================

-- 1. Create helper function to store Meta Ads token in Vault
CREATE OR REPLACE FUNCTION store_meta_ads_token(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete any existing Meta Ads token from Vault
  DELETE FROM vault.secrets WHERE name = 'meta_ads_access_token';
  -- Store new token encrypted in Vault
  PERFORM vault.create_secret(p_token, 'meta_ads_access_token', 'Meta Marketing API access token');
END;
$$;

-- 2. Create helper function to retrieve decrypted token from Vault
CREATE OR REPLACE FUNCTION get_meta_ads_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT decrypted_secret INTO v_token
  FROM vault.decrypted_secrets
  WHERE name = 'meta_ads_access_token'
  LIMIT 1;

  RETURN v_token;
END;
$$;

-- 3. Migrate existing token to Vault (if any exists)
DO $$
DECLARE
  v_existing_token TEXT;
BEGIN
  SELECT access_token INTO v_existing_token
  FROM meta_ads_config
  WHERE is_active = true
  LIMIT 1;

  IF v_existing_token IS NOT NULL AND v_existing_token != '' THEN
    PERFORM store_meta_ads_token(v_existing_token);
  END IF;
END;
$$;

-- 4. Drop the plaintext access_token column
ALTER TABLE meta_ads_config DROP COLUMN IF EXISTS access_token;
