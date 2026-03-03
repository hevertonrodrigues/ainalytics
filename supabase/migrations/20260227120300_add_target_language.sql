-- Migration: 20260227120300_add_target_language.sql
-- Description: Adds target_language column to companies table for bilingual AI report output.

ALTER TABLE companies ADD COLUMN target_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN companies.target_language IS 'ISO 639-1 language code for the primary monitoring language. AI report is produced in both this language and English.';
