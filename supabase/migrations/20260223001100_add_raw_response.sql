-- Add raw_request and raw_response columns to prompt_answers
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS raw_request JSONB;
ALTER TABLE prompt_answers ADD COLUMN IF NOT EXISTS raw_response JSONB;
