-- Create table: general_settings
CREATE TABLE IF NOT EXISTS general_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE general_settings ENABLE ROW LEVEL SECURITY;

-- SELECT policy: anyone can read general settings
-- Since it's prices, anon needs access for the landing page
CREATE POLICY "general_settings_select_all"
  ON general_settings FOR SELECT
  USING (true);

-- Updated_at trigger
CREATE TRIGGER set_general_settings_updated_at
  BEFORE UPDATE ON general_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed the initial exchange rates
INSERT INTO general_settings (key, value) VALUES
  ('USD_BRL', '5.0'),
  ('USD_EUR', '1.2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
