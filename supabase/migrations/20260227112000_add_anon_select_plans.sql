-- Allow anonymous (unauthenticated) users to read active plans
-- Needed for the landing page pricing section
CREATE POLICY "plans_select_anon"
  ON plans FOR SELECT
  TO anon
  USING (is_active = true);
