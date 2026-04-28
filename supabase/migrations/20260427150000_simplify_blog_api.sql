-- ============================================================================
-- Index AI — Simplify the blog API surface.
--
-- Public API is reduced to: categories, news, trending, ticker,
-- ranking-sectors, ranking, newsletter/register.
--
-- This migration drops all tables that no longer back a public endpoint, and
-- adds:
--   - blog_locale_meta — per-lang SEO config consumed by every endpoint
--   - blog_articles.trending_position — feeds the trending endpoint
-- ============================================================================

-- ─── Drop obsolete tables ───────────────────────────────────────────────────

DROP TABLE IF EXISTS blog_article_audio       CASCADE;
DROP TABLE IF EXISTS blog_bookmarks           CASCADE;
DROP TABLE IF EXISTS blog_article_events      CASCADE;
DROP TABLE IF EXISTS blog_citation_evidence   CASCADE;
DROP TABLE IF EXISTS blog_citation_corrections CASCADE;
DROP TABLE IF EXISTS blog_article_citations   CASCADE;
DROP TABLE IF EXISTS blog_article_revisions   CASCADE;

DROP TABLE IF EXISTS blog_engine_metrics_daily CASCADE;
DROP TABLE IF EXISTS blog_engine_translations  CASCADE;
DROP TABLE IF EXISTS blog_engines              CASCADE;

DROP TABLE IF EXISTS blog_homepage_cta           CASCADE;
DROP TABLE IF EXISTS blog_homepage_latest        CASCADE;
DROP TABLE IF EXISTS blog_homepage_stories       CASCADE;
DROP TABLE IF EXISTS blog_homepage_sidebar_items CASCADE;
DROP TABLE IF EXISTS blog_homepage_hero          CASCADE;
DROP TABLE IF EXISTS blog_site_strings           CASCADE;

DROP TABLE IF EXISTS blog_ranking_headlines    CASCADE;

DROP TYPE IF EXISTS blog_correction_status;

-- ─── Add trending_position to articles ──────────────────────────────────────

ALTER TABLE blog_articles ADD COLUMN trending_position INT;
CREATE INDEX idx_blog_articles_trending
  ON blog_articles(trending_position)
  WHERE trending_position IS NOT NULL AND status = 'published';

-- ─── Per-lang SEO meta (replaces blog_site_strings + blog_homepage_*) ───────

CREATE TABLE blog_locale_meta (
  lang                       TEXT PRIMARY KEY REFERENCES blog_languages(code),
  -- Site-wide
  site_title                 TEXT NOT NULL,
  site_description           TEXT NOT NULL,
  site_keywords              JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_og_image_url       TEXT,
  publisher_name             TEXT NOT NULL DEFAULT 'Ainalytics',
  publisher_url              TEXT NOT NULL DEFAULT 'https://indexai.news',
  publisher_logo_url         TEXT NOT NULL DEFAULT 'https://indexai.news/brand/logo.png',
  publisher_logo_width       INT  NOT NULL DEFAULT 512,
  publisher_logo_height      INT  NOT NULL DEFAULT 512,
  twitter_handle             TEXT,
  -- Trending (homepage) page copy
  trending_title             TEXT NOT NULL DEFAULT '',
  trending_description       TEXT NOT NULL DEFAULT '',
  trending_eyebrow           TEXT,
  -- Newsletter CTA shown on the home + article pages
  newsletter_eyebrow         TEXT,
  newsletter_title           TEXT,
  newsletter_text            TEXT,
  newsletter_placeholder     TEXT,
  newsletter_button          TEXT,
  newsletter_success_message TEXT,
  -- Rankings page copy
  rankings_title             TEXT NOT NULL DEFAULT '',
  rankings_description       TEXT NOT NULL DEFAULT '',
  -- Categories page copy (when a generic /categorias index exists)
  categories_title           TEXT NOT NULL DEFAULT '',
  categories_description     TEXT NOT NULL DEFAULT '',
  -- Path segment for category URLs ('categoria' / 'category') — derived; kept for convenience
  category_segment           TEXT NOT NULL DEFAULT 'category',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_blog_locale_meta_updated BEFORE UPDATE ON blog_locale_meta
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

ALTER TABLE blog_locale_meta ENABLE ROW LEVEL SECURITY;

-- ─── Seed locale meta ───────────────────────────────────────────────────────

INSERT INTO blog_locale_meta (
  lang, site_title, site_description, site_keywords,
  trending_title, trending_description, trending_eyebrow,
  newsletter_eyebrow, newsletter_title, newsletter_text, newsletter_placeholder, newsletter_button, newsletter_success_message,
  rankings_title, rankings_description,
  categories_title, categories_description,
  category_segment
) VALUES
  ('pt',
    'Index AI — Notícias sobre Generative Engine Optimization',
    'Notícias independentes sobre o futuro da busca generativa. Uma publicação Ainalytics.',
    '["GEO","Generative Engine Optimization","ChatGPT","Gemini","Perplexity","Claude","Grok","busca generativa","IA"]'::jsonb,
    'Em alta no Index AI',
    'As reportagens mais lidas sobre busca generativa, motores de IA e visibilidade de marca.',
    'Destaques',
    'Powered by Ainalytics',
    'Saiba o que a IA diz sobre a sua marca',
    'Monitore como ChatGPT, Gemini, Perplexity e Grok mencionam — ou omitem — sua marca. Teste grátis por 14 dias.',
    'seu@email.com',
    'Começar grátis',
    'Pronto! Em breve você receberá nossa primeira edição.',
    'Ranking de Visibilidade em IA (AVI)',
    'O Índice Ainalytics combina frequência de citação, posição média e sentimento em ChatGPT, Gemini, Claude, Perplexity e Grok.',
    'Categorias',
    'Pesquisa, produto, casos, opinião, LATAM e Europa.',
    'categoria'),

  ('es',
    'Index AI — Noticias sobre Generative Engine Optimization',
    'Noticias independientes sobre el futuro de la búsqueda generativa. Una publicación Ainalytics.',
    '["GEO","Generative Engine Optimization","ChatGPT","Gemini","Perplexity","Claude","Grok","búsqueda generativa","IA"]'::jsonb,
    'Tendencia en Index AI',
    'Los reportajes más leídos sobre búsqueda generativa, motores de IA y visibilidad de marca.',
    'Destacados',
    'Powered by Ainalytics',
    'Descubre qué dice la IA sobre tu marca',
    'Monitoriza cómo ChatGPT, Gemini, Perplexity y Grok mencionan —u omiten— tu marca. 14 días gratis.',
    'tu@email.com',
    'Empezar gratis',
    '¡Listo! Pronto recibirás nuestra primera edición.',
    'Ranking de Visibilidad en IA (AVI)',
    'El Índice Ainalytics combina frecuencia de citación, posición media y sentimiento en ChatGPT, Gemini, Claude, Perplexity y Grok.',
    'Categorías',
    'Investigación, producto, casos, opinión, LATAM y Europa.',
    'categoria'),

  ('en',
    'Index AI — News on Generative Engine Optimization',
    'Independent news on the future of generative search. An Ainalytics publication.',
    '["GEO","Generative Engine Optimization","ChatGPT","Gemini","Perplexity","Claude","Grok","generative search","AI"]'::jsonb,
    'Trending on Index AI',
    'The most-read stories on generative search, AI engines and brand visibility.',
    'Featured',
    'Powered by Ainalytics',
    'See what AI says about your brand',
    'Track how ChatGPT, Gemini, Perplexity and Grok mention — or omit — your brand. 14-day free trial.',
    'you@email.com',
    'Start free',
    'Done! You''ll receive our first edition shortly.',
    'AI Visibility Index (AVI)',
    'The Ainalytics index blends citation frequency, average position and sentiment across ChatGPT, Gemini, Claude, Perplexity and Grok.',
    'Categories',
    'Research, product, cases, opinion, LATAM and Europe.',
    'category')
ON CONFLICT (lang) DO NOTHING;

-- ─── Promote the existing seed article into the trending feed ──────────────

UPDATE blog_articles
   SET trending_position = 1, is_featured = true
 WHERE id = 'gen-search-traffic-war-2026';
