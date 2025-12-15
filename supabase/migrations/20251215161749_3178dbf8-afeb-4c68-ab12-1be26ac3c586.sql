-- Add 'processing' value to message_status enum
ALTER TYPE public.message_status ADD VALUE IF NOT EXISTS 'processing';

-- Add column to track when processing started (for cleanup of stuck messages)
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE;