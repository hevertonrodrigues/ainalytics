-- ============================================================
-- Create sources and prompt_answer_sources tables
-- ============================================================

-- Function to get tenant IDs for the current user (avoids infinite recursion in RLS)
CREATE OR REPLACE FUNCTION get_auth_tenant_ids() 
RETURNS SETOF uuid 
LANGUAGE sql 
SECURITY DEFINER 
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM tenant_users 
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- Function to extract base domain from URL
CREATE OR REPLACE FUNCTION extract_base_domain(url text) RETURNS text AS $$
DECLARE
  host text;
  parts text[];
  len int;
BEGIN
  -- Get host without protocol, www, and path/port
  host := substring(regexp_replace(url, '^(https?://)?(www\.)?', ''), '^([^/:]+)');
  
  -- Split by dot
  parts := string_to_array(host, '.');
  len := array_length(parts, 1);
  
  IF len <= 2 THEN
    RETURN host;
  END IF;
  
  -- Handle .co.uk, .com.br, etc.
  IF parts[len-1] IN ('co', 'com', 'org', 'net', 'edu', 'gov', 'mil', 'ac') THEN
    IF len >= 3 THEN
      RETURN parts[len-2] || '.' || parts[len-1] || '.' || parts[len];
    END IF;
  END IF;
  
  -- Default to last two parts
  RETURN parts[len-1] || '.' || parts[len];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- Table: sources
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_sources_tenant_id ON sources(tenant_id);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sources_select_own_tenant"
  ON sources FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );

CREATE TRIGGER set_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Table: prompt_answer_sources
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_answer_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES prompt_answers(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  annotation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_answer_sources_tenant_id ON prompt_answer_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_answer_sources_prompt_id ON prompt_answer_sources(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_answer_sources_answer_id ON prompt_answer_sources(answer_id);
CREATE INDEX IF NOT EXISTS idx_prompt_answer_sources_source_id ON prompt_answer_sources(source_id);

ALTER TABLE prompt_answer_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_answer_sources_select_own_tenant"
  ON prompt_answer_sources FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT get_auth_tenant_ids())
  );

CREATE TRIGGER set_prompt_answer_sources_updated_at
  BEFORE UPDATE ON prompt_answer_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Trigger function for prompt_answers
-- ============================================================
CREATE OR REPLACE FUNCTION process_prompt_answer_sources()
RETURNS TRIGGER AS $$
DECLARE
  src RECORD;
  anno RECORD;
  domain_name TEXT;
  src_id UUID;
  extracted_anno TEXT;
  processed_urls TEXT[] := '{}';
BEGIN
  -- 1. Process annotations first (these have specific text extraction)
  IF NEW.annotations IS NOT NULL AND jsonb_typeof(NEW.annotations) = 'array' THEN
    FOR anno IN SELECT * FROM jsonb_to_recordset(NEW.annotations) AS x(url text, title text, start_index int, end_index int) LOOP
      IF anno.url IS NULL THEN CONTINUE; END IF;

      domain_name := extract_base_domain(anno.url);
      
      -- Upsert source
      INSERT INTO sources (tenant_id, name, domain)
      VALUES (NEW.tenant_id, anno.title, domain_name)
      ON CONFLICT (tenant_id, domain) DO UPDATE SET name = COALESCE(sources.name, EXCLUDED.name), updated_at = now()
      RETURNING id INTO src_id;

      -- Extract annotation
      extracted_anno := NULL;
      IF anno.start_index IS NOT NULL AND anno.end_index IS NOT NULL AND NEW.answer_text IS NOT NULL THEN
        -- Postgres substring is 1-based, length is (end - start)
        extracted_anno := substring(NEW.answer_text FROM (anno.start_index + 1) FOR (anno.end_index - anno.start_index));
      END IF;

      -- Insert prompt_answer_sources
      INSERT INTO prompt_answer_sources (
        tenant_id, prompt_id, answer_id, source_id, url, title, annotation
      ) VALUES (
        NEW.tenant_id, NEW.prompt_id, NEW.id, src_id, anno.url, anno.title, extracted_anno
      );

      processed_urls := array_append(processed_urls, anno.url);
    END LOOP;
  END IF;

  -- 2. Process sources (skip URLs already processed from annotations)
  IF NEW.sources IS NOT NULL AND jsonb_typeof(NEW.sources) = 'array' THEN
    FOR src IN SELECT * FROM jsonb_to_recordset(NEW.sources) AS x(url text, title text) LOOP
      IF src.url IS NULL THEN CONTINUE; END IF;
      
      IF NOT (src.url = ANY(processed_urls)) THEN
        domain_name := extract_base_domain(src.url);
        
        -- Upsert source
        INSERT INTO sources (tenant_id, name, domain)
        VALUES (NEW.tenant_id, src.title, domain_name)
        ON CONFLICT (tenant_id, domain) DO UPDATE SET name = COALESCE(sources.name, EXCLUDED.name), updated_at = now()
        RETURNING id INTO src_id;

        -- Insert prompt_answer_sources (annotation is NULL)
        INSERT INTO prompt_answer_sources (
          tenant_id, prompt_id, answer_id, source_id, url, title, annotation
        ) VALUES (
          NEW.tenant_id, NEW.prompt_id, NEW.id, src_id, src.url, src.title, NULL
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to execute AFTER INSERT on prompt_answers
DROP TRIGGER IF EXISTS on_prompt_answer_created ON prompt_answers;
CREATE TRIGGER on_prompt_answer_created
AFTER INSERT ON prompt_answers
FOR EACH ROW
EXECUTE FUNCTION process_prompt_answer_sources();
