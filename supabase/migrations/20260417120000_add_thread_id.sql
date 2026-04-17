-- Add thread_id for conversation threading
ALTER TABLE sa_inbox_emails ADD COLUMN thread_id UUID;

-- Set thread_id to id for existing rows
UPDATE sa_inbox_emails SET thread_id = id WHERE thread_id IS NULL;

-- Make it NOT NULL for future
ALTER TABLE sa_inbox_emails ALTER COLUMN thread_id SET NOT NULL;

-- Create index for quick thread fetching
CREATE INDEX idx_sa_inbox_emails_thread_id ON sa_inbox_emails(thread_id);

-- Create a view to easily get the latest email per thread
CREATE OR REPLACE VIEW sa_inbox_threads_view AS
SELECT t.* FROM (
  SELECT *,
         ROW_NUMBER() OVER(PARTITION BY thread_id ORDER BY received_at DESC) as rn
  FROM sa_inbox_emails
) t WHERE t.rn = 1;
