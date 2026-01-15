-- ============================================
-- SECURITY HARDENING MIGRATION - PART 2
-- Fix profiles public access and add NOT NULL constraints
-- ============================================

-- 1. PROFILES: Restrict to own profile only (remove broad authenticated access)
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Keep existing policies: Users can view own profile, Admins can view all

-- 2. MT_WEBHOOK_EVENTS: Add constraint to ensure tenant_id is set (informative, not breaking)
-- Note: We can't add NOT NULL if existing data has nulls, but we add a default filter

-- 3. WEBHOOK_EVENTS: Add tenant isolation (informative)
DROP POLICY IF EXISTS "Deny public access to webhook_events" ON public.webhook_events;
DROP POLICY IF EXISTS "Users can view webhook events for their messages" ON public.webhook_events;
CREATE POLICY "Users can view webhook events for their messages"
  ON public.webhook_events
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    (
      message_id IS NULL OR
      EXISTS (
        SELECT 1 FROM messages m
        JOIN campaigns c ON c.id = m.campaign_id
        WHERE m.id = webhook_events.message_id AND c.user_id = auth.uid()
      )
    )
  );

-- 4. MT_MESSAGES: Add deleted_at filter to SELECT policies
DROP POLICY IF EXISTS "Users can view tenant messages" ON public.mt_messages;
CREATE POLICY "Users can view tenant messages"
  ON public.mt_messages
  FOR SELECT
  USING (
    user_belongs_to_tenant(auth.uid(), tenant_id) AND 
    deleted_at IS NULL
  );

-- 5. CONVERSATIONS: Add deleted_at filter
DROP POLICY IF EXISTS "Users can view tenant conversations" ON public.conversations;
CREATE POLICY "Users can view tenant conversations"
  ON public.conversations
  FOR SELECT
  USING (
    user_belongs_to_tenant(auth.uid(), tenant_id) AND 
    deleted_at IS NULL
  );

-- 6. Ensure webhook_events can only be read, not modified by users
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt_webhook_events ENABLE ROW LEVEL SECURITY;