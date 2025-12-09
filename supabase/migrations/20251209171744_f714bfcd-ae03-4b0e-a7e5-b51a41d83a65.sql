-- Enable realtime for messages table to track campaign progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;