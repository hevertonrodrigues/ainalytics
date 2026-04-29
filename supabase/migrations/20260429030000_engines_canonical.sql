-- ============================================================================
-- Engines: rename to the canonical name and tighten the ticker FK.
--
--   blog_engine_profiles               → blog_engines
--   blog_engine_profile_translations   → blog_engine_translations
--
-- Adds FK constraint on:
--   blog_ticker_items.engine_id  (NULLABLE → ON DELETE SET NULL)
--
-- The user-visible API contract stays identical — the public function
-- `/blog-engine-profiles/{lang}` still serves the same shape.
-- ============================================================================

ALTER TABLE IF EXISTS blog_engine_profiles             RENAME TO blog_engines;
ALTER TABLE IF EXISTS blog_engine_profile_translations RENAME TO blog_engine_translations;

-- Move the trigger names + index/constraint names to match the new table name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_engine_profiles_updated'
  ) THEN
    EXECUTE 'ALTER TRIGGER trg_blog_engine_profiles_updated ON blog_engines RENAME TO trg_blog_engines_updated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_engine_profile_translations_updated'
  ) THEN
    EXECUTE 'ALTER TRIGGER trg_blog_engine_profile_translations_updated ON blog_engine_translations RENAME TO trg_blog_engine_translations_updated';
  END IF;
END $$;

-- Drop FK from translations if it points at the old name (it doesn't, but
-- belt-and-suspenders) and re-add with the canonical name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blog_engine_profile_translations_engine_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE blog_engine_translations DROP CONSTRAINT blog_engine_profile_translations_engine_id_fkey';
    EXECUTE 'ALTER TABLE blog_engine_translations ADD CONSTRAINT blog_engine_translations_engine_id_fkey FOREIGN KEY (engine_id) REFERENCES blog_engines(id) ON DELETE CASCADE';
  END IF;
END $$;

-- Quarantine ticker rows pointing at engines we don't know about.
UPDATE blog_ticker_items t
   SET engine_id = NULL
 WHERE t.engine_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM blog_engines e WHERE e.id = t.engine_id);

-- Idempotent FK setup on ticker.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_blog_ticker_items_engine'
      AND table_name = 'blog_ticker_items'
  ) THEN
    EXECUTE 'ALTER TABLE blog_ticker_items DROP CONSTRAINT fk_blog_ticker_items_engine';
  END IF;
END $$;

ALTER TABLE blog_ticker_items
  ADD CONSTRAINT fk_blog_ticker_items_engine
  FOREIGN KEY (engine_id) REFERENCES blog_engines(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_blog_ticker_items_engine ON blog_ticker_items
  IS 'engine_id now references blog_engines(id) — was free-text';
