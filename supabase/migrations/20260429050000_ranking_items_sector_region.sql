-- ============================================================================
-- blog_ranking_items: denormalize sector_id and region_id onto each row.
--
-- Until now, an item's sector and region were derived from its parent snapshot
-- (blog_ranking_snapshots.region / .sector). That made every filter or join
-- across items go through the snapshot, and prevented mixed-classification
-- snapshots (e.g. a "global" snapshot whose items are scoped to different
-- regions). Storing the ids on the item itself makes filter queries faster
-- (no extra join), the API more uniform (rows expose stable ids alongside
-- name/score), and the frontend leaderboard can match by stable id rather
-- than locale-dependent label.
--
-- Both columns are constrained by real FKs:
--   sector_id → blog_sectors(id)   — restrict on delete (orphan rows would
--                                     break ranking integrity)
--   region_id → blog_regions(id)   — restrict on delete (same)
--
-- Existing rows are backfilled from the parent snapshot, so the migration
-- works on production without manual data prep.
-- ============================================================================

-- 1. Add the columns (nullable initially so we can backfill).
ALTER TABLE blog_ranking_items
  ADD COLUMN IF NOT EXISTS sector_id TEXT,
  ADD COLUMN IF NOT EXISTS region_id TEXT;

-- 2. Backfill from the parent snapshot. Snapshots are the source of truth
--    for (region, sector) until per-item overrides start being authored.
UPDATE blog_ranking_items i
   SET sector_id = COALESCE(i.sector_id, s.sector),
       region_id = COALESCE(i.region_id, s.region)
  FROM blog_ranking_snapshots s
 WHERE s.id = i.snapshot_id
   AND (i.sector_id IS NULL OR i.region_id IS NULL);

-- 3. Quarantine any orphan ids that would block FK validation. We use the
--    same `uncategorized` sentinel that 20260429010000_sector_fks.sql
--    introduced so existing tooling stays consistent. For region we fall
--    back to `global` (always present per 20260429020000_regions_table.sql).
DO $$
BEGIN
  -- Sector sentinel — already created by 20260429010000, but be defensive
  -- in case migrations get reordered.
  INSERT INTO blog_sectors (id, position, is_active)
  VALUES ('uncategorized', 0, false)
  ON CONFLICT (id) DO NOTHING;

  UPDATE blog_ranking_items i
     SET sector_id = 'uncategorized'
   WHERE i.sector_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM blog_sectors s WHERE s.id = i.sector_id);

  UPDATE blog_ranking_items i
     SET region_id = 'global'
   WHERE i.region_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM blog_regions r WHERE r.id = i.region_id);
END $$;

-- 4. Enforce NOT NULL after the backfill. If any row is still NULL at this
--    point the migration aborts — that means the parent snapshot itself
--    has a NULL region or sector, which violates a stronger invariant we
--    don't want to silently paper over.
ALTER TABLE blog_ranking_items
  ALTER COLUMN sector_id SET NOT NULL,
  ALTER COLUMN region_id SET NOT NULL;

-- 5. Foreign keys (idempotent — drop-and-recreate so re-runs are safe).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ranking_items_sector'
      AND table_name = 'blog_ranking_items'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ranking_items DROP CONSTRAINT fk_blog_ranking_items_sector';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ranking_items_region'
      AND table_name = 'blog_ranking_items'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ranking_items DROP CONSTRAINT fk_blog_ranking_items_region';
  END IF;
END $$;

ALTER TABLE blog_ranking_items
  ADD CONSTRAINT fk_blog_ranking_items_sector
  FOREIGN KEY (sector_id) REFERENCES blog_sectors(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE blog_ranking_items
  ADD CONSTRAINT fk_blog_ranking_items_region
  FOREIGN KEY (region_id) REFERENCES blog_regions(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 6. Indexes for the common filter shapes:
--    - by region+sector (the primary filter combo on the public rankings)
--    - by sector alone (sector tabs on the leaderboard)
--    - by region alone (market filter)
CREATE INDEX IF NOT EXISTS idx_blog_ranking_items_region_sector_score
  ON blog_ranking_items (region_id, sector_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_blog_ranking_items_sector
  ON blog_ranking_items (sector_id);

CREATE INDEX IF NOT EXISTS idx_blog_ranking_items_region
  ON blog_ranking_items (region_id);
