-- Add tombstone field to conversations to prevent reactivation of deleted conversations
-- When a conversation is deleted, deleted_reason is set to 'user_deleted'
-- Future dispatches should CREATE NEW conversations instead of reactivating tombstoned ones

-- Add deleted_reason to track why conversation was deleted
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

-- Add window tracking columns for 24h window display
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS window_opened_at timestamp with time zone DEFAULT NULL;

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS window_expires_at timestamp with time zone DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.conversations.deleted_reason IS 'Reason for deletion: user_deleted prevents reactivation, system_deleted allows reactivation';
COMMENT ON COLUMN public.conversations.window_opened_at IS 'Timestamp when 24h window was opened (last inbound message)';
COMMENT ON COLUMN public.conversations.window_expires_at IS 'Timestamp when 24h window expires (window_opened_at + 24h)';