-- Create webhook_events table to track all webhook calls
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  phone TEXT,
  status TEXT,
  payload JSONB NOT NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view webhook events
CREATE POLICY "Users can view webhook events for their messages"
ON public.webhook_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.id = webhook_events.message_id
    AND c.user_id = auth.uid()
  )
  OR message_id IS NULL
);

-- Create index for better performance
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_message_id ON public.webhook_events(message_id);
CREATE INDEX idx_webhook_events_phone ON public.webhook_events(phone);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;