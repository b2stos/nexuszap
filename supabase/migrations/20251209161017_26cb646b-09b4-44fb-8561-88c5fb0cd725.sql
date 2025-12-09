-- Drop the existing policy that has the data leakage vulnerability
DROP POLICY IF EXISTS "Users can view webhook events for their messages" ON webhook_events;

-- Create a new secure policy without the NULL condition
-- Users can only see webhook events linked to their own messages via campaigns
CREATE POLICY "Users can view webhook events for their messages" 
ON webhook_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM messages m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.id = webhook_events.message_id 
    AND c.user_id = auth.uid()
  )
);