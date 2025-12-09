-- Add whatsapp_message_id column to messages table for webhook correlation
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS whatsapp_message_id text;

-- Create index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id 
ON public.messages(whatsapp_message_id);

-- Create index for phone-based lookups via contacts
CREATE INDEX IF NOT EXISTS idx_contacts_phone 
ON public.contacts(phone);