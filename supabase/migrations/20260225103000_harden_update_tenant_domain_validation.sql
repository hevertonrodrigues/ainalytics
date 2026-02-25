-- ============================================================
-- Harden update_tenant_domain() to prevent SSRF-oriented inputs
-- ============================================================
-- Validates and normalizes main_domain server-side (do not trust frontend).
-- Accepts hostname only (no scheme, path, query, fragment, credentials, port).
-- Blocks localhost, private IP ranges, and common internal suffixes.

CREATE OR REPLACE FUNCTION public.update_tenant_domain(p_tenant_id uuid, p_main_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
  v_label text;
BEGIN
  v_domain := lower(trim(coalesce(p_main_domain, '')));

  IF v_domain = '' THEN
    RAISE EXCEPTION 'Invalid domain';
  END IF;

  -- Hostname only (no URLs / credentials / ports / paths)
  IF v_domain ~ '^[a-z]+://' OR position('/' in v_domain) > 0 OR position('?' in v_domain) > 0
     OR position('#' in v_domain) > 0 OR position('@' in v_domain) > 0 OR position(':' in v_domain) > 0 THEN
    RAISE EXCEPTION 'Domain must be a hostname only (e.g. example.com)';
  END IF;

  IF right(v_domain, 1) = '.' THEN
    v_domain := left(v_domain, length(v_domain) - 1);
  END IF;

  IF v_domain = ''
     OR length(v_domain) > 253
     OR position('.' in v_domain) = 0
     OR position('..' in v_domain) > 0
     OR v_domain !~ '^[a-z0-9.-]+$'
     OR left(v_domain, 1) IN ('-', '.')
     OR right(v_domain, 1) IN ('-', '.') THEN
    RAISE EXCEPTION 'Invalid domain';
  END IF;

  -- Validate labels (1..63 chars, no leading/trailing hyphen)
  FOREACH v_label IN ARRAY string_to_array(v_domain, '.') LOOP
    IF v_label IS NULL OR v_label = '' OR length(v_label) > 63
       OR left(v_label, 1) = '-' OR right(v_label, 1) = '-' THEN
      RAISE EXCEPTION 'Invalid domain';
    END IF;
  END LOOP;

  -- Block local/internal names and private IP literals
  IF v_domain = 'localhost'
     OR v_domain LIKE '%.localhost'
     OR v_domain LIKE '%.local'
     OR v_domain LIKE '%.internal'
     OR v_domain ~ '^[0-9.]+$'
     OR v_domain ~ '^127\.'
     OR v_domain ~ '^10\.'
     OR v_domain ~ '^192\.168\.'
     OR v_domain ~ '^169\.254\.'
     OR v_domain ~ '^172\.(1[6-9]|2[0-9]|3[0-1])\.' THEN
    RAISE EXCEPTION 'Private/internal domains are not allowed';
  END IF;

  -- Check access
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE tenants
  SET main_domain = v_domain,
      updated_at = now()
  WHERE id = p_tenant_id;
END;
$$;
