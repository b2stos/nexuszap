-- Quick Replies table for fast responses
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  shortcut VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, shortcut)
);

-- Conversation drafts table for saving unsent messages
CREATE TABLE public.conversation_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Internal reactions table (visual only, not sent to customer)
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.mt_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for quick_replies
CREATE POLICY "Users can view quick replies from their tenant"
  ON public.quick_replies FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id, auth.uid()));

CREATE POLICY "Admins can create quick replies"
  ON public.quick_replies FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "Admins can update quick replies"
  ON public.quick_replies FOR UPDATE
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "Admins can delete quick replies"
  ON public.quick_replies FOR DELETE
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

-- RLS policies for conversation_drafts
CREATE POLICY "Users can manage their own drafts"
  ON public.conversation_drafts FOR ALL
  USING (auth.uid() = user_id);

-- RLS policies for message_reactions
CREATE POLICY "Users can view reactions from their tenant messages"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mt_messages m
      WHERE m.id = message_id
      AND public.user_belongs_to_tenant(m.tenant_id, auth.uid())
    )
  );

CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mt_messages m
      WHERE m.id = message_id
      AND public.user_belongs_to_tenant(m.tenant_id, auth.uid())
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Add assigned_user info to conversations (for presence/assignment)
-- This already exists, but let's add indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON public.conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status ON public.conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mt_messages_conversation ON public.mt_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_replies_tenant ON public.quick_replies(tenant_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_quick_replies_updated_at
  BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversation_drafts_updated_at
  BEFORE UPDATE ON public.conversation_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();