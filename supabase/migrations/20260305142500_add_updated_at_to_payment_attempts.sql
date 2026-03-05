-- The payment_attempts table is missing the updated_at column,
-- which causes the update_updated_at_column() trigger to fail.
-- Add it if it doesn't exist.
ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
