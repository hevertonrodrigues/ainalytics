-- Migration: 20260227120400_create_geo_checklist.sql
-- Description: Creates GEO checklist system with predefined items and per-company results.

-- ─── Checklist Items (predefined evaluation criteria) ─────────────────

CREATE TABLE geo_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL CHECK (category IN ('ai_access','content_structure','structured_data','discoverability','content_quality')),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  weight      INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 10),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Company Checklist Results ────────────────────────────────────────

CREATE TABLE company_checklist_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES geo_checklist_items(id) ON DELETE CASCADE,
  score             TEXT NOT NULL CHECK (score IN ('very_bad','bad','neutral','good','perfect')),
  details           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, checklist_item_id)
);

CREATE INDEX idx_company_checklist_company ON company_checklist_results(company_id);

-- RLS
ALTER TABLE geo_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_checklist_results ENABLE ROW LEVEL SECURITY;

-- Checklist items are readable by all authenticated users
CREATE POLICY "checklist_items_select" ON geo_checklist_items
  FOR SELECT TO authenticated USING (true);

-- Company checklist results follow same access as companies
CREATE POLICY "checklist_results_select" ON company_checklist_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_companies tc
      JOIN tenant_users tu ON tu.tenant_id = tc.tenant_id
      WHERE tc.company_id = company_checklist_results.company_id
        AND tu.user_id = auth.uid()
        AND tu.is_active = true
    )
  );

-- Service role can insert/update results
CREATE POLICY "checklist_results_service_all" ON company_checklist_results
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Remove geo_issues column (replaced by checklist) ─────────────────

ALTER TABLE companies DROP COLUMN IF EXISTS geo_issues;

-- ─── Seed: AI Access ──────────────────────────────────────────────────

INSERT INTO geo_checklist_items (category, key, name, description, weight, sort_order) VALUES
('ai_access', 'allows_gptbot',        'GPTBot Access',           'robots.txt allows GPTBot (ChatGPT) to crawl the website',                   10, 1),
('ai_access', 'allows_claudebot',     'ClaudeBot Access',        'robots.txt allows ClaudeBot (Anthropic Claude) to crawl the website',        8, 2),
('ai_access', 'allows_perplexitybot', 'PerplexityBot Access',    'robots.txt allows PerplexityBot to crawl the website',                       8, 3),
('ai_access', 'allows_googlebot',     'Googlebot Access',        'robots.txt allows Googlebot (Google AI Overviews) to crawl',                 9, 4),
('ai_access', 'no_blanket_block',     'No Blanket Bot Blocking', 'No wildcard User-agent: * Disallow: / rule that blocks all bots',           10, 5),
('ai_access', 'no_captcha',           'No Anti-Bot Captcha',     'Pages do not use captcha or anti-bot mechanisms that block AI crawlers',     10, 6);

-- ─── Seed: Content Structure ──────────────────────────────────────────

INSERT INTO geo_checklist_items (category, key, name, description, weight, sort_order) VALUES
('content_structure', 'has_title_tags',       'Title Tags Present',       'Pages have proper <title> tags that describe content clearly',              9, 10),
('content_structure', 'has_meta_descriptions', 'Meta Descriptions',       'Pages have meta descriptions that summarize content for AI engines',        8, 11),
('content_structure', 'has_h1_headings',      'H1 Headings Present',     'Pages have H1 headings providing clear topic hierarchy',                    7, 12),
('content_structure', 'heading_hierarchy',     'Heading Hierarchy',       'Content uses proper H1→H2→H3 heading structure for logical organization',   7, 13),
('content_structure', 'sufficient_content',    'Sufficient Word Count',   'Pages have enough text content (300+ words) for AI comprehension',          6, 14),
('content_structure', 'server_side_rendered',  'Server-Side Rendered',    'Content is server-side rendered and accessible without JavaScript',          9, 15);

-- ─── Seed: Structured Data ───────────────────────────────────────────

INSERT INTO geo_checklist_items (category, key, name, description, weight, sort_order) VALUES
('structured_data', 'has_jsonld',          'JSON-LD Schema Markup',    'Website uses JSON-LD structured data (schema.org) for AI parsing',           9, 20),
('structured_data', 'has_org_schema',      'Organization Schema',      'Has Organization or LocalBusiness schema for brand identity',                8, 21),
('structured_data', 'has_faq_schema',      'FAQ Schema',               'Uses FAQ schema markup to surface answers in AI responses',                  7, 22),
('structured_data', 'has_product_schema',  'Product/Service Schema',   'Products or services have structured data for direct AI understanding',      7, 23),
('structured_data', 'has_breadcrumb',      'Breadcrumb Schema',        'Breadcrumb schema helps AI understand site structure and navigation',        5, 24);

-- ─── Seed: Discoverability ───────────────────────────────────────────

INSERT INTO geo_checklist_items (category, key, name, description, weight, sort_order) VALUES
('discoverability', 'has_sitemap',          'XML Sitemap Present',       'Website has an XML sitemap for AI crawlers to discover pages',              9, 30),
('discoverability', 'sitemap_in_robots',    'Sitemap in robots.txt',     'Sitemap URL is referenced in robots.txt for easier discovery',              6, 31),
('discoverability', 'fast_page_load',       'Fast Page Load (<3s)',      'Pages load within 3 seconds, avoiding AI crawler timeouts',                 7, 32),
('discoverability', 'https_enabled',        'HTTPS Enabled',             'Website uses HTTPS, a trust signal for AI engines',                         8, 33),
('discoverability', 'mobile_friendly',      'Mobile-Friendly Design',    'Website is responsive and mobile-friendly (Google mobile-first indexing)',   6, 34);

-- ─── Seed: Content Quality ───────────────────────────────────────────

INSERT INTO geo_checklist_items (category, key, name, description, weight, sort_order) VALUES
('content_quality', 'demonstrates_expertise', 'Demonstrates Expertise',    'Content shows expert knowledge and E-E-A-T signals',                       9, 40),
('content_quality', 'unique_value',           'Unique Value Proposition',  'Content provides original insights not found on competing sites',           8, 41),
('content_quality', 'clear_organization',     'Well-Organized Content',    'Content has clear sections, lists, and logical flow for AI parsing',        7, 42),
('content_quality', 'answers_questions',      'Answers Common Questions',  'Content directly answers questions users might ask AI assistants',           8, 43),
('content_quality', 'brand_authority',        'Strong Brand Authority',    'Clear brand identity with about page, contact info, and social proof',      6, 44);
