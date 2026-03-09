-- Migration: add_tenant_code_column
-- Description: Adds a code column to tenants table and updates handle_new_user trigger

-- 1. Add code column to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS code TEXT;

-- 2. Update handle_new_user to extract and store the code from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_main_domain TEXT;
  v_code TEXT;
  v_base_slug TEXT;
  v_final_slug TEXT;
  v_suffix INTEGER;
  v_slug_exists BOOLEAN;
BEGIN
  -- Extract metadata from the new user
  v_tenant_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'tenant_name'), '');
  v_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  v_main_domain := NULLIF(TRIM(NEW.raw_user_meta_data->>'main_domain'), '');
  v_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'code'), '');

  -- Default to 'My Organization' if tenant_name is missing
  IF v_tenant_name IS NULL THEN
    v_tenant_name := 'My Organization';
  END IF;

  -- Default to 'User' if full_name is missing
  IF v_full_name IS NULL THEN
    v_full_name := 'User';
  END IF;

  -- 1. Generate tenant slug
  v_base_slug := TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(v_tenant_name), '[^a-z0-9]+', '-', 'g'));
  IF v_base_slug = '' THEN
    v_base_slug := 'tenant';
  END IF;

  v_final_slug := v_base_slug;

  -- Loop to find a unique slug
  LOOP
    SELECT EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_final_slug) INTO v_slug_exists;
    IF NOT v_slug_exists THEN
      EXIT; -- Found a unique slug
    END IF;
    
    -- If it exists, append a random 4-digit suffix and try again
    v_suffix := floor(random() * 9000 + 1000)::INT;
    v_final_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  -- 2. Create the tenant (now includes code)
  INSERT INTO public.tenants (name, slug, main_domain, code)
  VALUES (v_tenant_name, v_final_slug, v_main_domain, v_code)
  RETURNING id INTO v_tenant_id;

  -- 3. Create the profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name, email, phone, locale)
  VALUES (
    NEW.id,
    v_tenant_id,
    v_full_name,
    NEW.email,
    v_phone,
    'en' -- Default locale
  );

  -- 4. Create the tenant_users record (owner role)
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
  VALUES (v_tenant_id, NEW.id, 'owner', true);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user trigger failed: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
