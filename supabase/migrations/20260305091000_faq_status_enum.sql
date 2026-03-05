-- Create enum type for FAQ status
CREATE TYPE faq_status AS ENUM ('public', 'private', 'inactive');

-- Drop RLS policies that reference the status column
DROP POLICY IF EXISTS "faq_select_anon" ON faq;
DROP POLICY IF EXISTS "faq_select_authenticated" ON faq;

-- Drop the CHECK constraint BEFORE altering column type
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class r ON c.conrelid = r.oid
  WHERE r.relname = 'faq'
    AND c.contype = 'c'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE faq DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Convert column from TEXT to ENUM
ALTER TABLE faq
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE faq_status USING status::faq_status,
  ALTER COLUMN status SET DEFAULT 'public';

-- Recreate RLS policies using the enum type
CREATE POLICY "faq_select_anon"
  ON faq FOR SELECT
  TO anon
  USING (status = 'public');

CREATE POLICY "faq_select_authenticated"
  ON faq FOR SELECT
  TO authenticated
  USING (status IN ('public', 'private'));
