-- ============================================================================
-- Index AI — Blog content schema (powers the public blog API).
-- All tables prefixed `blog_` to avoid naming conflicts with the SaaS schema.
-- Mutations only via Edge Functions (admin client). RLS enabled, no policies.
-- ============================================================================

-- ─── Helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION blog_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Languages ───────────────────────────────────────────────────────────

CREATE TABLE blog_languages (
  code         TEXT PRIMARY KEY,
  locale       TEXT NOT NULL,
  label        TEXT NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_languages_updated BEFORE UPDATE ON blog_languages
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 2. Authors ─────────────────────────────────────────────────────────────

CREATE TABLE blog_authors (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE,
  image_url    TEXT,
  social       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_authors_updated BEFORE UPDATE ON blog_authors
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_author_translations (
  author_id    TEXT NOT NULL REFERENCES blog_authors(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,
  bio          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (author_id, lang)
);
CREATE TRIGGER trg_blog_author_translations_updated BEFORE UPDATE ON blog_author_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 3. Categories ──────────────────────────────────────────────────────────

CREATE TABLE blog_categories (
  id           TEXT PRIMARY KEY,
  position     INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_categories_updated BEFORE UPDATE ON blog_categories
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_category_translations (
  category_id  TEXT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  slug         TEXT NOT NULL,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  seo_title    TEXT,
  segment      TEXT NOT NULL DEFAULT 'category',  -- 'categoria' (pt/es) / 'category' (en)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, lang),
  UNIQUE (lang, slug)
);
CREATE TRIGGER trg_blog_category_translations_updated BEFORE UPDATE ON blog_category_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_category_translations_slug ON blog_category_translations(lang, slug);

-- ─── 4. Tags ────────────────────────────────────────────────────────────────

CREATE TABLE blog_tags (
  id           TEXT PRIMARY KEY,
  is_engine    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_tags_updated BEFORE UPDATE ON blog_tags
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_tag_translations (
  tag_id       TEXT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  slug         TEXT NOT NULL,
  label        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, lang),
  UNIQUE (lang, slug)
);
CREATE TRIGGER trg_blog_tag_translations_updated BEFORE UPDATE ON blog_tag_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 5. Engines ─────────────────────────────────────────────────────────────

CREATE TABLE blog_engines (
  id            TEXT PRIMARY KEY,
  vendor        TEXT,
  color         TEXT NOT NULL DEFAULT '#000000',
  short_name    TEXT NOT NULL DEFAULT '',
  position      INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_engines_updated BEFORE UPDATE ON blog_engines
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_engine_translations (
  engine_id            TEXT NOT NULL REFERENCES blog_engines(id) ON DELETE CASCADE,
  lang                 TEXT NOT NULL REFERENCES blog_languages(code),
  name                 TEXT NOT NULL,
  citations_trend_30d  TEXT,
  user_base_label      TEXT,
  latest_headline      TEXT,
  latest_published_at  TIMESTAMPTZ,
  latest_article_id    TEXT,                            -- FK added below after blog_articles
  segment              TEXT NOT NULL DEFAULT 'engine',  -- 'motor' (pt/es) / 'engine' (en)
  article_count        INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (engine_id, lang)
);
CREATE TRIGGER trg_blog_engine_translations_updated BEFORE UPDATE ON blog_engine_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_engine_metrics_daily (
  engine_id    TEXT NOT NULL REFERENCES blog_engines(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  citations    INT NOT NULL DEFAULT 0,
  mentions     INT NOT NULL DEFAULT 0,
  queries      INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (engine_id, date)
);
CREATE TRIGGER trg_blog_engine_metrics_daily_updated BEFORE UPDATE ON blog_engine_metrics_daily
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_engine_metrics_date ON blog_engine_metrics_daily(date DESC);

-- ─── 6. Articles ────────────────────────────────────────────────────────────

CREATE TYPE blog_article_status AS ENUM ('draft','scheduled','published','retracted');

CREATE TABLE blog_articles (
  id                 TEXT PRIMARY KEY,
  category_id        TEXT NOT NULL REFERENCES blog_categories(id),
  read_time_minutes  INT NOT NULL DEFAULT 5,
  image_url          TEXT,
  image_width        INT,
  image_height       INT,
  status             blog_article_status NOT NULL DEFAULT 'draft',
  is_featured        BOOLEAN NOT NULL DEFAULT false,
  published_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  modified_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_articles_updated BEFORE UPDATE ON blog_articles
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_articles_published
  ON blog_articles(published_at DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX idx_blog_articles_category
  ON blog_articles(category_id, published_at DESC)
  WHERE status = 'published';

-- Add the engine_translations.latest_article_id FK now that blog_articles exists
ALTER TABLE blog_engine_translations
  ADD CONSTRAINT fk_blog_engine_translations_latest_article
  FOREIGN KEY (latest_article_id) REFERENCES blog_articles(id) ON DELETE SET NULL;

CREATE TABLE blog_article_translations (
  article_id      TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  lang            TEXT NOT NULL REFERENCES blog_languages(code),
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  dek             TEXT NOT NULL,
  display_date    TEXT NOT NULL DEFAULT '',
  read_time_label TEXT NOT NULL DEFAULT '',
  body            JSONB NOT NULL DEFAULT '[]'::jsonb,
  toc             JSONB NOT NULL DEFAULT '[]'::jsonb,
  ui              JSONB NOT NULL DEFAULT '{}'::jsonb,
  sidebar_cta     JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_alt       TEXT,
  meta_keywords   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- localized keyword list (article-level)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, lang),
  UNIQUE (lang, slug)
);
CREATE TRIGGER trg_blog_article_translations_updated BEFORE UPDATE ON blog_article_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_article_translations_slug ON blog_article_translations(lang, slug);

-- Per-locale FTS indexes for blog_search
CREATE INDEX idx_blog_article_translations_fts_pt ON blog_article_translations
  USING gin (to_tsvector('portuguese', title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'pt';
CREATE INDEX idx_blog_article_translations_fts_es ON blog_article_translations
  USING gin (to_tsvector('spanish', title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'es';
CREATE INDEX idx_blog_article_translations_fts_en ON blog_article_translations
  USING gin (to_tsvector('english', title || ' ' || dek || ' ' || body::text))
  WHERE lang = 'en';

CREATE TABLE blog_article_authors (
  article_id  TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES blog_authors(id),
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, author_id)
);

CREATE TABLE blog_article_tags (
  article_id  TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES blog_tags(id),
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE blog_article_keywords (
  article_id  TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, keyword)
);

CREATE TABLE blog_article_citations (
  article_id      TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  engine_id       TEXT NOT NULL,                                  -- not FK: engine_id may include variants like 'gemini-2-5'
  engine_name     TEXT NOT NULL,                                  -- snapshot for display
  engine_color    TEXT NOT NULL DEFAULT '#000000',
  status          TEXT NOT NULL CHECK (status IN ('yes','no','partial')),
  evidence_url    TEXT,
  last_seen_at    TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, engine_id)
);
CREATE TRIGGER trg_blog_article_citations_updated BEFORE UPDATE ON blog_article_citations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_article_revisions (
  id           BIGSERIAL PRIMARY KEY,
  article_id   TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  version      INT NOT NULL,
  modified_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary      TEXT,
  diff         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, version)
);
CREATE INDEX idx_blog_article_revisions_article ON blog_article_revisions(article_id, version DESC);

-- ─── 7. Brands & Rankings ───────────────────────────────────────────────────

CREATE TABLE blog_brands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  country     TEXT,                                       -- 'BR','ES','GLOBAL'
  sector      TEXT NOT NULL,                              -- 'fintech','bank','retail',...
  labels      JSONB NOT NULL DEFAULT '{}'::jsonb,         -- { lang -> localized sector label }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_brands_updated BEFORE UPDATE ON blog_brands
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_sector_translations (
  sector      TEXT NOT NULL,
  lang        TEXT NOT NULL REFERENCES blog_languages(code),
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sector, lang)
);
CREATE TRIGGER trg_blog_sector_translations_updated BEFORE UPDATE ON blog_sector_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_ranking_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  period_label  TEXT NOT NULL,
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  region        TEXT NOT NULL,
  sector        TEXT NOT NULL,
  queries_analyzed BIGINT NOT NULL DEFAULT 0,
  sectors_covered  INT NOT NULL DEFAULT 0,
  engines_monitored JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_from, region, sector)
);
CREATE TRIGGER trg_blog_ranking_snapshots_updated BEFORE UPDATE ON blog_ranking_snapshots
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_ranking_items (
  snapshot_id   BIGINT NOT NULL REFERENCES blog_ranking_snapshots(id) ON DELETE CASCADE,
  rank          INT NOT NULL,
  brand_id      TEXT NOT NULL REFERENCES blog_brands(id),
  score         INT NOT NULL,
  delta         TEXT NOT NULL DEFAULT '0',
  direction     TEXT NOT NULL CHECK (direction IN ('up','down','flat')),
  PRIMARY KEY (snapshot_id, rank)
);

CREATE TABLE blog_ranking_headlines (
  region        TEXT NOT NULL,
  sector        TEXT NOT NULL,
  lang          TEXT NOT NULL REFERENCES blog_languages(code),
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  text          TEXT NOT NULL DEFAULT '',
  table_title   TEXT NOT NULL DEFAULT '',
  cta_label     TEXT NOT NULL DEFAULT '',
  region_label  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (region, sector, lang)
);
CREATE TRIGGER trg_blog_ranking_headlines_updated BEFORE UPDATE ON blog_ranking_headlines
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 8. Ticker ──────────────────────────────────────────────────────────────

CREATE TABLE blog_ticker_items (
  id           BIGSERIAL PRIMARY KEY,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  position     INT NOT NULL,
  engine_id    TEXT,                                      -- nullable for 'multi'/'ai-overviews'
  label        TEXT NOT NULL,
  value        TEXT NOT NULL,
  trend        TEXT NOT NULL CHECK (trend IN ('up','down','neutral')),
  link_url     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lang, position)
);
CREATE TRIGGER trg_blog_ticker_items_updated BEFORE UPDATE ON blog_ticker_items
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 9. Site shell + homepage components ────────────────────────────────────

CREATE TABLE blog_site_strings (
  lang         TEXT PRIMARY KEY REFERENCES blog_languages(code),
  nav          JSONB NOT NULL DEFAULT '{}'::jsonb,
  header       JSONB NOT NULL DEFAULT '{}'::jsonb,
  footer       JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,        -- title/description/publisher
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_site_strings_updated BEFORE UPDATE ON blog_site_strings
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_homepage_hero (
  lang                 TEXT PRIMARY KEY REFERENCES blog_languages(code),
  primary_article_id   TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  eyebrow              TEXT NOT NULL DEFAULT '',
  tags                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_date         TEXT NOT NULL DEFAULT '',
  title                TEXT NOT NULL DEFAULT '',
  dek                  TEXT NOT NULL DEFAULT '',
  author_id            TEXT REFERENCES blog_authors(id) ON DELETE SET NULL,
  author_name          TEXT NOT NULL DEFAULT '',
  author_role          TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_homepage_hero_updated BEFORE UPDATE ON blog_homepage_hero
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_homepage_sidebar_items (
  id                   BIGSERIAL PRIMARY KEY,
  lang                 TEXT NOT NULL REFERENCES blog_languages(code),
  position             INT NOT NULL,
  title                TEXT NOT NULL,
  engine_id            TEXT,
  engine_label         TEXT NOT NULL DEFAULT '',
  time_label           TEXT NOT NULL DEFAULT '',
  link_kind            TEXT NOT NULL DEFAULT 'article',
  link_article_id      TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lang, position)
);
CREATE TRIGGER trg_blog_homepage_sidebar_items_updated BEFORE UPDATE ON blog_homepage_sidebar_items
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_homepage_stories (
  id                   TEXT PRIMARY KEY,
  lang                 TEXT NOT NULL REFERENCES blog_languages(code),
  position             INT NOT NULL,
  category_id          TEXT NOT NULL REFERENCES blog_categories(id),
  title                TEXT NOT NULL,
  dek                  TEXT NOT NULL,
  author_id            TEXT REFERENCES blog_authors(id) ON DELETE SET NULL,
  author_name          TEXT NOT NULL DEFAULT '',
  read_time_label      TEXT NOT NULL DEFAULT '',
  date_label           TEXT NOT NULL DEFAULT '',
  category_label       TEXT NOT NULL DEFAULT '',
  link_kind            TEXT NOT NULL DEFAULT 'article',
  link_article_id      TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  image_variant        INT NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lang, position)
);
CREATE TRIGGER trg_blog_homepage_stories_updated BEFORE UPDATE ON blog_homepage_stories
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_homepage_latest (
  lang                 TEXT PRIMARY KEY REFERENCES blog_languages(code),
  title                TEXT NOT NULL DEFAULT '',
  title_em             TEXT NOT NULL DEFAULT '',
  filters              JSONB NOT NULL DEFAULT '[]'::jsonb,
  sidebar_title        TEXT NOT NULL DEFAULT '',
  sidebar_all          TEXT NOT NULL DEFAULT '',
  report_cta_label     TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_homepage_latest_updated BEFORE UPDATE ON blog_homepage_latest
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE TABLE blog_homepage_cta (
  lang                 TEXT PRIMARY KEY REFERENCES blog_languages(code),
  eyebrow              TEXT NOT NULL DEFAULT '',
  title                TEXT NOT NULL DEFAULT '',
  title_em             TEXT NOT NULL DEFAULT '',
  text                 TEXT NOT NULL DEFAULT '',
  placeholder          TEXT NOT NULL DEFAULT '',
  button               TEXT NOT NULL DEFAULT '',
  submit_to            TEXT NOT NULL DEFAULT 'POST /api/v1/newsletter/subscribe',
  quotes               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_homepage_cta_updated BEFORE UPDATE ON blog_homepage_cta
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 10. Newsletter ─────────────────────────────────────────────────────────

CREATE TYPE blog_subscriber_status AS ENUM ('pending','active','unsubscribed','bounced');

CREATE TABLE blog_newsletter_subscribers (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  lang                TEXT NOT NULL REFERENCES blog_languages(code),
  topics              JSONB NOT NULL DEFAULT '[]'::jsonb,
  source              TEXT,
  status              blog_subscriber_status NOT NULL DEFAULT 'pending',
  confirmation_token  TEXT,
  unsubscribe_token   TEXT,
  ip_hash             TEXT,
  user_agent          TEXT,
  subscribed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at        TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  unsubscribe_reason  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_newsletter_subscribers_updated BEFORE UPDATE ON blog_newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_newsletter_status ON blog_newsletter_subscribers(status, subscribed_at DESC);

-- ─── 11. Citation corrections ───────────────────────────────────────────────

CREATE TYPE blog_correction_status AS ENUM ('open','reviewing','resolved','rejected');

CREATE TABLE blog_citation_corrections (
  id                BIGSERIAL PRIMARY KEY,
  ticket_id         TEXT NOT NULL UNIQUE,
  article_id        TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  engine_id         TEXT,
  brand_id          TEXT REFERENCES blog_brands(id) ON DELETE SET NULL,
  evidence_url      TEXT,
  claimed_fact      TEXT,
  correction_type   TEXT NOT NULL,
  submitted_by      JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { name, email, company, role }
  status            blog_correction_status NOT NULL DEFAULT 'open',
  resolution_notes  TEXT,
  ip_hash           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_citation_corrections_updated BEFORE UPDATE ON blog_citation_corrections
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

CREATE INDEX idx_blog_citation_corrections_status ON blog_citation_corrections(status, created_at DESC);

-- ─── 12. Citation evidence (used by /citations/evidence/[id]) ───────────────

CREATE TABLE blog_citation_evidence (
  id              TEXT PRIMARY KEY,
  article_id      TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  engine_id       TEXT,
  screenshot_url  TEXT,
  captured_prompt TEXT,
  captured_response TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_citation_evidence_updated BEFORE UPDATE ON blog_citation_evidence
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 13. Article events (analytics: views, shares, listens, bookmarks) ─────

CREATE TABLE blog_article_events (
  id           BIGSERIAL PRIMARY KEY,
  article_id   TEXT REFERENCES blog_articles(id) ON DELETE SET NULL,
  user_id      UUID,                                       -- references auth.users when authenticated
  event_type   TEXT NOT NULL,                              -- 'view','share','listen_start','bookmark','unbookmark'
  channel      TEXT,
  ip_hash      TEXT,
  user_agent   TEXT,
  referrer     TEXT,
  lang         TEXT REFERENCES blog_languages(code),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_article_events_article ON blog_article_events(article_id, created_at DESC);
CREATE INDEX idx_blog_article_events_type ON blog_article_events(event_type, created_at DESC);

-- ─── 14. Bookmarks (auth) ───────────────────────────────────────────────────

CREATE TABLE blog_bookmarks (
  user_id      UUID NOT NULL,                              -- auth.users(id) — not enforced as FK to keep blog optional
  article_id   TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX idx_blog_bookmarks_user ON blog_bookmarks(user_id, saved_at DESC);

-- ─── 15. Audio narrations (for /listen) ─────────────────────────────────────

CREATE TABLE blog_article_audio (
  article_id        TEXT NOT NULL REFERENCES blog_articles(id) ON DELETE CASCADE,
  lang              TEXT NOT NULL REFERENCES blog_languages(code),
  voice             TEXT NOT NULL DEFAULT '',
  audio_url         TEXT NOT NULL,
  format            TEXT NOT NULL DEFAULT 'hls',
  duration_seconds  INT NOT NULL DEFAULT 0,
  is_signed         BOOLEAN NOT NULL DEFAULT false,
  signed_until      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, lang)
);
CREATE TRIGGER trg_blog_article_audio_updated BEFORE UPDATE ON blog_article_audio
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();

-- ─── 16. RLS — enable on every blog_* table; mutations only via Edge Fns ────

ALTER TABLE blog_languages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_author_translations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_category_translations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tag_translations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_engines                ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_engine_translations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_engine_metrics_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_articles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_translations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_authors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_keywords       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_citations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_revisions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_brands                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_sector_translations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_ranking_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_ranking_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_ranking_headlines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_ticker_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_site_strings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_homepage_hero          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_homepage_sidebar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_homepage_stories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_homepage_latest        ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_homepage_cta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_citation_corrections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_citation_evidence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_bookmarks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_article_audio          ENABLE ROW LEVEL SECURITY;

-- No SELECT policies are added: all reads are served via Edge Functions using
-- the service_role key. The public blog API enforces caching/rate-limiting at
-- the function layer; the SA admin UI also goes through Edge Functions.
