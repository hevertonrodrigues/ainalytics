-- Migration: 20260303120500_drop_geo_checklist.sql
-- Description: Drops the old GEO checklist tables, replaced by the 25-factor
--              algorithmic scoring system defined in geo-factors.ts.

-- Drop company results first (has FK to checklist items)
DROP TABLE IF EXISTS company_checklist_results CASCADE;

-- Drop the checklist items table
DROP TABLE IF EXISTS geo_checklist_items CASCADE;
