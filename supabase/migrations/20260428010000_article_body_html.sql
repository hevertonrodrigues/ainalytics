-- ============================================================================
-- Index AI — Replace blocky article body with a single HTML string.
--
-- Before: blog_article_translations.body = JSONB array of {type, text} blocks
-- After:  blog_article_translations.body = TEXT (HTML)
--
-- The new editor on /sa/blog/news/:id uses Tiptap to author HTML directly.
-- Bulk imports continue to accept the legacy block-array shape — the API
-- adapter (blog-admin) converts arrays to HTML on the way in.
-- ============================================================================

-- ─── 1. Drop FTS indexes that reference body (column type change blocker) ──

DROP INDEX IF EXISTS idx_blog_article_translations_fts_pt;
DROP INDEX IF EXISTS idx_blog_article_translations_fts_es;
DROP INDEX IF EXISTS idx_blog_article_translations_fts_en;

-- ─── 2. Add temp TEXT column and populate it from the existing JSONB blocks

ALTER TABLE blog_article_translations ADD COLUMN body_text TEXT;

UPDATE blog_article_translations t
   SET body_text = COALESCE(
     (
       SELECT string_agg(
         CASE
           WHEN b->>'type' = 'p'          THEN '<p>'          || replace(replace(replace(COALESCE(b->>'text', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>'
           WHEN b->>'type' = 'h2'         THEN '<h2>'         || replace(replace(replace(COALESCE(b->>'text', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h2>'
           WHEN b->>'type' = 'h3'         THEN '<h3>'         || replace(replace(replace(COALESCE(b->>'text', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h3>'
           WHEN b->>'type' = 'blockquote' THEN '<blockquote>' || replace(replace(replace(COALESCE(b->>'text', ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</blockquote>'
           ELSE ''
         END,
         E'\n'
       )
       FROM jsonb_array_elements(t.body) AS b
     ),
     ''
   )
 WHERE jsonb_typeof(t.body) = 'array';

UPDATE blog_article_translations
   SET body_text = body #>> '{}'
 WHERE jsonb_typeof(body) = 'string' AND body_text IS NULL;

UPDATE blog_article_translations
   SET body_text = ''
 WHERE body_text IS NULL;

-- ─── 3. Swap the columns ───────────────────────────────────────────────────

ALTER TABLE blog_article_translations DROP COLUMN body;
ALTER TABLE blog_article_translations RENAME COLUMN body_text TO body;
ALTER TABLE blog_article_translations ALTER COLUMN body SET DEFAULT '';
ALTER TABLE blog_article_translations ALTER COLUMN body SET NOT NULL;

-- ─── 4. Recreate FTS indexes against the new TEXT column ───────────────────

CREATE INDEX idx_blog_article_translations_fts_pt ON blog_article_translations
  USING gin (to_tsvector('portuguese', title || ' ' || dek || ' ' || body))
  WHERE lang = 'pt';
CREATE INDEX idx_blog_article_translations_fts_es ON blog_article_translations
  USING gin (to_tsvector('spanish', title || ' ' || dek || ' ' || body))
  WHERE lang = 'es';
CREATE INDEX idx_blog_article_translations_fts_en ON blog_article_translations
  USING gin (to_tsvector('english', title || ' ' || dek || ' ' || body))
  WHERE lang = 'en';
