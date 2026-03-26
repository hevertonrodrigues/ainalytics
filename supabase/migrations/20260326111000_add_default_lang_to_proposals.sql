ALTER TABLE proposals ADD COLUMN IF NOT EXISTS default_lang TEXT NOT NULL DEFAULT 'en' CHECK (default_lang IN ('en', 'es', 'pt-br'));
