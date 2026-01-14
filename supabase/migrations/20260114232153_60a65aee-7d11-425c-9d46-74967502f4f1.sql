-- Add deleted_at column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Add deleted_at column to mt_messages table
ALTER TABLE public.mt_messages 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster filtering on deleted_at
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON public.conversations (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mt_messages_deleted_at ON public.mt_messages (deleted_at) WHERE deleted_at IS NULL;