-- Add attachments JSONB column for file storage paths
ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload to the support folder
CREATE POLICY "support_attachments_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

-- Storage policy: authenticated users in same tenant can read
CREATE POLICY "support_attachments_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'support-attachments');
