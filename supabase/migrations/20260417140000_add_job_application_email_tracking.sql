-- ============================================================================
-- Job Applications — Email Tracking
-- Tracks the last outbound email sent to a candidate and the first open
-- detected via tracking pixel (careers-email-track edge function).
-- ============================================================================

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_applications_last_email_sent_at
  ON job_applications (last_email_sent_at);
