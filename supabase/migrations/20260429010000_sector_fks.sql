-- ============================================================================
-- Sectors: harden the soft references into real foreign keys.
--
-- Until now, blog_brands.sector, blog_ranking_snapshots.sector,
-- blog_ranking_headlines.sector and blog_ranking_faq.sector held a free-text
-- value that "should" match a row in blog_sectors. This migration upgrades
-- them to real FKs (with sane ON DELETE behavior).
--
-- We DO NOT rename the columns to avoid a ripple-through admin/API change —
-- the column type stays TEXT and the value stays the sector id.
-- ============================================================================

-- Helper: drop the constraint if it already exists (idempotent re-runs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_brands_sector' AND table_name = 'blog_brands'
  ) THEN
    EXECUTE 'ALTER TABLE blog_brands DROP CONSTRAINT fk_blog_brands_sector';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ranking_snapshots_sector' AND table_name = 'blog_ranking_snapshots'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ranking_snapshots DROP CONSTRAINT fk_blog_ranking_snapshots_sector';
  END IF;
END $$;

-- Quarantine any orphan sector ids (they would block FK creation). We don't
-- delete the rows — we set them to a sentinel so the admin can fix them.
DO $$
BEGIN
  -- Make sure the sentinel exists in blog_sectors so the FK validates.
  INSERT INTO blog_sectors (id, position, is_active)
  VALUES ('uncategorized', 0, false)
  ON CONFLICT (id) DO NOTHING;

  UPDATE blog_brands b
     SET sector = 'uncategorized'
   WHERE b.sector IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM blog_sectors s WHERE s.id = b.sector);

  UPDATE blog_ranking_snapshots rs
     SET sector = 'uncategorized'
   WHERE rs.sector IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM blog_sectors s WHERE s.id = rs.sector);
END $$;

-- The real foreign keys.
ALTER TABLE blog_brands
  ADD CONSTRAINT fk_blog_brands_sector
  FOREIGN KEY (sector) REFERENCES blog_sectors(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE blog_ranking_snapshots
  ADD CONSTRAINT fk_blog_ranking_snapshots_sector
  FOREIGN KEY (sector) REFERENCES blog_sectors(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- blog_ranking_faq.sector is nullable (sector-agnostic FAQs use NULL).
-- Use SET NULL on delete so the global FAQ stays.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_ranking_faq' AND column_name = 'sector'
  ) THEN
    UPDATE blog_ranking_faq f
       SET sector = NULL
     WHERE f.sector IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM blog_sectors s WHERE s.id = f.sector);

    EXECUTE '
      ALTER TABLE blog_ranking_faq
        ADD CONSTRAINT fk_blog_ranking_faq_sector
        FOREIGN KEY (sector) REFERENCES blog_sectors(id) ON UPDATE CASCADE ON DELETE SET NULL';
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_blog_brands_sector            ON blog_brands           IS 'sector now references blog_sectors(id) — was free-text';
COMMENT ON CONSTRAINT fk_blog_ranking_snapshots_sector ON blog_ranking_snapshots IS 'sector now references blog_sectors(id) — was free-text';
