-- Create storage bucket for campaign media
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-media', 'campaign-media', true);

-- Add media_urls column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN media_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create RLS policies for campaign-media bucket
CREATE POLICY "Users can upload their own campaign media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own campaign media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'campaign-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own campaign media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'campaign-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own campaign media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'campaign-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access to campaign media
CREATE POLICY "Public can view campaign media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campaign-media');