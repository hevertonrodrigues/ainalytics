-- ============================================================================
-- Regions: same treatment as sectors — promote `region` from a free-text id
-- into a real lookup table with a FK constraint.
--
-- New tables:
--   blog_regions               — id, position, is_active
--   blog_region_translations   — region_id, lang, label, description
--
-- Adds FK constraints on:
--   blog_ranking_snapshots.region  (NOT NULL → ON DELETE RESTRICT)
--   blog_ranking_faq.region        (NULLABLE → ON DELETE SET NULL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS blog_regions (
  id          TEXT PRIMARY KEY,
  position    INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_regions_updated BEFORE UPDATE ON blog_regions
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_regions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS blog_region_translations (
  region_id   TEXT NOT NULL REFERENCES blog_regions(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL REFERENCES blog_languages(code) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (region_id, lang)
);
CREATE TRIGGER trg_blog_region_translations_updated BEFORE UPDATE ON blog_region_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_region_translations ENABLE ROW LEVEL SECURITY;

-- Seed the four canonical regions used across the app today.
INSERT INTO blog_regions (id, position) VALUES
  ('global', 0),
  ('br',     1),
  ('us',     2),
  ('es',     3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_region_translations (region_id, lang, label, description) VALUES
  ('global', 'pt', 'Global',         'Visão consolidada de todas as regiões.'),
  ('global', 'es', 'Global',         'Vista consolidada de todas las regiones.'),
  ('global', 'en', 'Global',         'Consolidated view across all regions.'),

  ('br',     'pt', 'Brasil',         'Mercado brasileiro.'),
  ('br',     'es', 'Brasil',         'Mercado brasileño.'),
  ('br',     'en', 'Brazil',         'Brazilian market.'),

  ('us',     'pt', 'Estados Unidos', 'Mercado norte-americano.'),
  ('us',     'es', 'Estados Unidos', 'Mercado estadounidense.'),
  ('us',     'en', 'United States',  'United States market.'),

  ('es',     'pt', 'Espanha',        'Mercado espanhol.'),
  ('es',     'es', 'España',         'Mercado español.'),
  ('es',     'en', 'Spain',          'Spanish market.')
ON CONFLICT (region_id, lang) DO NOTHING;

-- Drop old constraints if they exist (idempotent re-runs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ranking_snapshots_region' AND table_name = 'blog_ranking_snapshots'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ranking_snapshots DROP CONSTRAINT fk_blog_ranking_snapshots_region';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ranking_faq_region' AND table_name = 'blog_ranking_faq'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ranking_faq DROP CONSTRAINT fk_blog_ranking_faq_region';
  END IF;
END $$;

-- Quarantine orphan region values into the 'global' bucket.
UPDATE blog_ranking_snapshots rs
   SET region = 'global'
 WHERE rs.region IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM blog_regions r WHERE r.id = rs.region);

UPDATE blog_ranking_faq f
   SET region = NULL
 WHERE f.region IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM blog_regions r WHERE r.id = f.region);

-- Real foreign keys.
ALTER TABLE blog_ranking_snapshots
  ADD CONSTRAINT fk_blog_ranking_snapshots_region
  FOREIGN KEY (region) REFERENCES blog_regions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE blog_ranking_faq
  ADD CONSTRAINT fk_blog_ranking_faq_region
  FOREIGN KEY (region) REFERENCES blog_regions(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_blog_ranking_snapshots_region ON blog_ranking_snapshots IS 'region now references blog_regions(id) — was free-text';
COMMENT ON CONSTRAINT fk_blog_ranking_faq_region        ON blog_ranking_faq        IS 'region now references blog_regions(id) — was free-text';
