-- Migration: random_tenant_name
-- Description: Auto-generate tenant name and slug with random 3 words
--              instead of defaulting to 'My Organization'

-- 1. Create a function that generates a random 3-word name
CREATE OR REPLACE FUNCTION public.generate_random_words()
RETURNS TEXT AS $$
DECLARE
  adjectives TEXT[] := ARRAY[
    'Swift', 'Bright', 'Bold', 'Calm', 'Quick', 'Warm', 'Cool', 'Sharp', 'Grand', 'Pure',
    'Vast', 'Deep', 'Wild', 'Keen', 'Fair', 'Brave', 'True', 'Clear', 'Noble', 'Prime',
    'Vivid', 'Rapid', 'Steady', 'Agile', 'Crisp', 'Fierce', 'Silent', 'Golden', 'Iron', 'Lunar',
    'Solar', 'Cosmic', 'Alpine', 'Arctic', 'Amber', 'Jade', 'Cobalt', 'Onyx', 'Silver', 'Scarlet',
    'Gentle', 'Radiant', 'Mighty', 'Nimble', 'Daring', 'Subtle', 'Serene', 'Rugged', 'Polished', 'Stellar',
    'Azure', 'Crimson', 'Emerald', 'Ivory', 'Coral', 'Frozen', 'Blazing', 'Velvet', 'Crystal', 'Granite',
    'Mystic', 'Ancient', 'Modern', 'Royal', 'Primal', 'Lucid', 'Fluid', 'Solid', 'Woven', 'Forged',
    'Rising', 'Drifting', 'Soaring', 'Roaming', 'Sailing', 'Copper', 'Bronze', 'Marble', 'Timber', 'Rustic',
    'Electric', 'Phantom', 'Sapphire', 'Titan', 'Vertex', 'Frosty', 'Silken', 'Dusted', 'Hollow', 'Sunlit',
    'Mossy', 'Dusty', 'Clouded', 'Nested', 'Braided', 'Gilded', 'Tempered', 'Layered', 'Veiled', 'Etched'
  ];
  nouns TEXT[] := ARRAY[
    'Tiger', 'Eagle', 'River', 'Cloud', 'Storm', 'Cedar', 'Coral', 'Flame', 'Frost', 'Grove',
    'Maple', 'Ocean', 'Pearl', 'Ridge', 'Stone', 'Bloom', 'Creek', 'Dune', 'Ember', 'Haven',
    'Lotus', 'Oasis', 'Prism', 'Spark', 'Vista', 'Falcon', 'Heron', 'Panda', 'Wolf', 'Lynx',
    'Raven', 'Otter', 'Crane', 'Hawk', 'Fox', 'Birch', 'Aspen', 'Willow', 'Sage', 'Ivy',
    'Meteor', 'Comet', 'Quartz', 'Flint', 'Basalt', 'Harbor', 'Island', 'Glacier', 'Geyser', 'Canyon',
    'Badger', 'Condor', 'Jaguar', 'Dolphin', 'Bison', 'Osprey', 'Mantis', 'Beetle', 'Salmon', 'Turtle',
    'Pine', 'Fern', 'Orchid', 'Daisy', 'Poppy', 'Thunder', 'Breeze', 'Torrent', 'Ripple', 'Tide',
    'Marble', 'Agate', 'Jasper', 'Garnet', 'Topaz', 'Meadow', 'Tundra', 'Steppe', 'Ravine', 'Plateau',
    'Compass', 'Lantern', 'Anvil', 'Loom', 'Chisel', 'Arrow', 'Shield', 'Banner', 'Feather', 'Pebble',
    'Sunset', 'Horizon', 'Aurora', 'Shadow', 'Twilight', 'Dagger', 'Goblet', 'Scroll', 'Candle', 'Mirror'
  ];
  extras TEXT[] := ARRAY[
    'Peak', 'Cove', 'Dale', 'Glen', 'Vale', 'Mesa', 'Reef', 'Arch', 'Apex', 'Drift',
    'Luna', 'Nova', 'Aura', 'Echo', 'Wave', 'Core', 'Link', 'Nexus', 'Vertex', 'Pulse',
    'Orbit', 'Range', 'Trail', 'Quest', 'Forge', 'Haven', 'Crown', 'Vault', 'Helm', 'Spire',
    'Crest', 'Blaze', 'Shield', 'Anchor', 'Beacon', 'Compass', 'Harbor', 'Cairn', 'Bastion', 'Citadel',
    'Zenith', 'Horizon', 'Summit', 'Pinnacle', 'Keystone', 'Signal', 'Lantern', 'Passage', 'Gateway', 'Origin',
    'Matrix', 'Prism', 'Cipher', 'Shard', 'Rune', 'Tide', 'Ember', 'Spark', 'Glow', 'Flare',
    'Locus', 'Pivot', 'Node', 'Bridge', 'Relay', 'Sentry', 'Guard', 'Watch', 'Vigil', 'Ward',
    'Atlas', 'Scope', 'Chart', 'Ledger', 'Index', 'Depot', 'Cache', 'Trove', 'Reserve', 'Cellar',
    'Channel', 'Conduit', 'Portal', 'Threshold', 'Crossing', 'Outpost', 'Station', 'Tower', 'Terrace', 'Parapet',
    'Venture', 'Endeavor', 'Mission', 'Campaign', 'Chapter', 'Garden', 'Orchard', 'Vineyard', 'Meadow', 'Clearing'
  ];
  w1 TEXT;
  w2 TEXT;
  w3 TEXT;
BEGIN
  w1 := adjectives[1 + floor(random() * array_length(adjectives, 1))::INT];
  w2 := nouns[1 + floor(random() * array_length(nouns, 1))::INT];
  w3 := extras[1 + floor(random() * array_length(extras, 1))::INT];
  RETURN w1 || ' ' || w2 || ' ' || w3;
END;
$$ LANGUAGE plpgsql;

-- 2. Update handle_new_user to use random 3-word names when tenant_name is missing
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

  -- Generate random 3-word name if tenant_name is missing
  IF v_tenant_name IS NULL THEN
    v_tenant_name := public.generate_random_words();
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
