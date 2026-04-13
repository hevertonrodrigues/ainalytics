-- ============================================================================
-- Job Opportunities & Applications (Company-wide, no tenant_id)
-- ============================================================================

-- ─── 0. Storage bucket for resumes ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-resumes',
  'job-resumes',
  true,
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload resumes (edge function uses service_role, but just in case)
CREATE POLICY "job_resumes_anon_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'job-resumes');

-- Allow public read access to uploaded resumes
CREATE POLICY "job_resumes_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'job-resumes');

-- ─── 1. job_opportunities ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_opportunities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  department    TEXT,
  location      TEXT,
  contract_type TEXT,
  compensation  TEXT,
  description_md TEXT NOT NULL,
  is_published  BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for public listing queries
CREATE INDEX IF NOT EXISTS idx_job_opportunities_published
  ON job_opportunities(is_published, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_opportunities_slug
  ON job_opportunities(slug);

-- Enable RLS
ALTER TABLE job_opportunities ENABLE ROW LEVEL SECURITY;

-- Anyone can read published opportunities
CREATE POLICY "job_opportunities_anon_select_published"
  ON job_opportunities FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Updated_at trigger
CREATE TRIGGER set_job_opportunities_updated_at
  BEFORE UPDATE ON job_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─── 2. job_opportunity_questions ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_opportunity_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES job_opportunities(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'text',         -- text, textarea, select, radio, checkbox
  options         JSONB,                                 -- for select/radio/checkbox
  is_required     BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_opp_questions_opportunity
  ON job_opportunity_questions(opportunity_id, sort_order);

-- Enable RLS
ALTER TABLE job_opportunity_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can read questions for published opportunities
CREATE POLICY "job_opp_questions_anon_select"
  ON job_opportunity_questions FOR SELECT
  TO anon, authenticated
  USING (
    opportunity_id IN (
      SELECT id FROM job_opportunities WHERE is_published = true
    )
  );


-- ─── 3. job_applications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID NOT NULL REFERENCES job_opportunities(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  linkedin_url    TEXT,
  resume_url      TEXT,
  answers         JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'new',            -- new, reviewing, interview, rejected, hired
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_opportunity
  ON job_applications(opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_applications_status
  ON job_applications(status);

CREATE INDEX IF NOT EXISTS idx_job_applications_email
  ON job_applications(email);

-- Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Anon can insert applications (public form)
CREATE POLICY "job_applications_anon_insert"
  ON job_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT/UPDATE/DELETE for anon — only service_role (edge functions) can read


-- ─── 4. Seed: SDR/Closer de Vendas ─────────────────────────────────────────

INSERT INTO job_opportunities (
  id, slug, title, department, location, contract_type, compensation, description_md, is_published, published_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'sdr-closer-vendas',
  'SDR/Closer de Vendas | SaaS B2B | 100% Remoto',
  'Vendas',
  '100% Remoto',
  'PJ',
  'Fixo + Comissão por venda',
  E'## Sobre a Ainalytics\n\nA Ainalytics é uma plataforma SaaS que ajuda empresas a monitorar e otimizar a visibilidade de suas marcas em plataformas de IA como ChatGPT, Claude, Gemini e Grok. Somos pioneiros em GEO (Generative Engine Optimization) — o novo SEO para a era da inteligência artificial.\n\n## Sobre a Vaga\n\nEstamos buscando um(a) SDR/Closer de Vendas para transformar leads qualificados em clientes. Os leads já chegam via campanhas de tráfego pago — sua missão é conduzir essas oportunidades do primeiro contato até a assinatura da plataforma.\n\nVocê terá autonomia e papel estratégico no crescimento comercial da Ainalytics.\n\n## O que você vai fazer\n\n- Receber e qualificar leads vindos de campanhas de Ads\n- Fazer o primeiro contato via mensagem e ligação\n- Agendar e conduzir reuniões online de demonstração da plataforma\n- Acompanhar o lead em todo o funil até o fechamento (assinatura)\n- Gerenciar o pipeline de vendas no CRM interno da Ainalytics\n- Reportar resultados e contribuir com feedbacks para o time de marketing\n\n## O que buscamos\n\n- Experiência com vendas consultivas, inside sales ou atendimento comercial\n- Boa comunicação verbal e escrita\n- Organização para gerenciar múltiplos leads simultaneamente\n- Familiaridade com ferramentas digitais (CRM, videoconferência, WhatsApp Business)\n- Vontade de crescer junto com a empresa\n\n## Diferenciais (não obrigatórios)\n\n- Experiência com vendas de SaaS ou produtos de tecnologia\n- Conhecimento básico sobre marketing digital, SEO ou IA\n- Inglês básico/intermediário\n\n## Modelo de Trabalho\n\n- 100% remoto\n- Contrato PJ\n- Remuneração: fixo + comissão por venda\n\n## Por que a Ainalytics?\n\n- Mercado novo e em explosão — GEO é o futuro da visibilidade digital\n- Autonomia e impacto direto nos resultados\n- Produto inovador que se vende com uma boa demo\n- Oportunidade real de crescimento conforme a empresa escala',
  true,
  now()
) ON CONFLICT (slug) DO NOTHING;

-- Custom questions for SDR opportunity
INSERT INTO job_opportunity_questions (opportunity_id, question_text, question_type, options, is_required, sort_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Por que você quer trabalhar na Ainalytics?', 'textarea', NULL, true, 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Qual sua experiência com vendas consultivas ou inside sales?', 'textarea', NULL, true, 2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Tem experiência com vendas de SaaS ou produtos de tecnologia?', 'select', '["Sim", "Não"]'::jsonb, true, 3),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Qual seu nível de inglês?', 'select', '["Básico", "Intermediário", "Avançado", "Fluente"]'::jsonb, false, 4)
ON CONFLICT DO NOTHING;
