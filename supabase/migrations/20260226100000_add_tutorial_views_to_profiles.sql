-- Add tutorial_views column to profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'tutorial_views') THEN
        ALTER TABLE profiles ADD COLUMN tutorial_views JSONB DEFAULT '{}';
    END IF;
END $$;
