-- Make campaign-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'campaign-media';