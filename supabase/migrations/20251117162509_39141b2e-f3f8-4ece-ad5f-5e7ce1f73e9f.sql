-- Remove the public read policy for campaign media
DROP POLICY IF EXISTS "Public can view campaign media" ON storage.objects;