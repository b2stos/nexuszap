-- Fix: webhook_events RLS policy allows viewing orphaned events (message_id IS NULL)
-- This policy was too permissive: allowed any authenticated user to see events without message_id

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view webhook events for their messages" ON public.webhook_events;

-- Create stricter policy: users can ONLY view events linked to their campaigns
-- Events without message_id are NOT accessible (no orphaned event exposure)
CREATE POLICY "Users can only view their campaign webhook events"
ON public.webhook_events
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND message_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.campaigns c ON c.id = m.campaign_id
    WHERE m.id = webhook_events.message_id 
    AND c.user_id = auth.uid()
  )
);

-- Add comment explaining the security fix
COMMENT ON POLICY "Users can only view their campaign webhook events" ON public.webhook_events IS 
'Security fix: Prevents viewing orphaned webhook events (message_id IS NULL) that may contain sensitive data like phone numbers and message content from external providers.';