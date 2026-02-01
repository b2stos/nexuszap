-- Create storage bucket for inbox media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbox-media',
  'inbox-media',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr', 'video/mp4', 'video/3gpp', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for inbox media
CREATE POLICY "Public read access for inbox media"
ON storage.objects FOR SELECT
USING (bucket_id = 'inbox-media');

-- Service role can insert media (for webhook)
CREATE POLICY "Service role can insert inbox media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inbox-media');