ALTER TABLE proposals ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light'));
