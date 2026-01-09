
-- =============================================
-- NEXUS ZAP - MULTI-TENANT DATABASE FOUNDATION
-- =============================================

-- 1) ENUMS
CREATE TYPE public.tenant_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.tenant_user_role AS ENUM ('owner', 'admin', 'agent');
CREATE TYPE public.provider_type AS ENUM ('official_bsp', 'unofficial');
CREATE TYPE public.channel_status AS ENUM ('connected', 'disconnected', 'error', 'pending');
CREATE TYPE public.conversation_status AS ENUM ('open', 'resolved', 'archived');
CREATE TYPE public.message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.message_type AS ENUM ('text', 'template', 'image', 'document', 'audio', 'video', 'sticker', 'location', 'contact', 'system');
CREATE TYPE public.message_delivery_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE public.template_status AS ENUM ('approved', 'pending', 'rejected');
CREATE TYPE public.campaign_status_v2 AS ENUM ('draft', 'scheduled', 'running', 'paused', 'done', 'cancelled');
CREATE TYPE public.campaign_recipient_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

-- 2) TENANTS (empresas/organizações)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status tenant_status NOT NULL DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_tenants_status ON public.tenants(status);

-- 3) TENANT_USERS (relacionamento usuário <-> tenant com role)
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_user_role NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON public.tenant_users(user_id);

-- 4) PROVIDERS (provedores de API: NotificaMe, etc)
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type provider_type NOT NULL,
  base_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir NotificaMe como provider padrão
INSERT INTO public.providers (name, display_name, type, base_url) 
VALUES ('notificame', 'NotificaMe BSP', 'official_bsp', 'https://api.notifica.me');

-- 5) CHANNELS (número de WhatsApp conectado)
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id),
  name TEXT NOT NULL,
  phone_number TEXT,
  status channel_status NOT NULL DEFAULT 'pending',
  provider_config JSONB DEFAULT '{}', -- token, webhook_secret, etc (encrypted at app level)
  provider_phone_id TEXT, -- ID do número no provider
  verified_name TEXT,
  quality_rating TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channels_tenant ON public.channels(tenant_id);
CREATE INDEX idx_channels_status ON public.channels(status);
CREATE INDEX idx_channels_provider ON public.channels(provider_id);

-- 6) CONTACTS (contatos por tenant)
CREATE TABLE public.mt_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_mt_contacts_tenant ON public.mt_contacts(tenant_id);
CREATE INDEX idx_mt_contacts_phone ON public.mt_contacts(phone);
CREATE INDEX idx_mt_contacts_tenant_phone ON public.mt_contacts(tenant_id, phone);

-- 7) CONVERSATIONS (conversas = thread entre canal e contato)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.mt_contacts(id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'open',
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ, -- para regra de 24h
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, contact_id)
);

CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_conversations_channel ON public.conversations(channel_id);
CREATE INDEX idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_assigned ON public.conversations(assigned_user_id);
CREATE INDEX idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- 8) MESSAGES (mensagens individuais)
CREATE TABLE public.mt_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.mt_contacts(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  type message_type NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  template_name TEXT,
  template_variables JSONB,
  provider_message_id TEXT,
  status message_delivery_status NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_detail TEXT,
  reply_to_message_id UUID REFERENCES public.mt_messages(id) ON DELETE SET NULL,
  sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mt_messages_tenant ON public.mt_messages(tenant_id);
CREATE INDEX idx_mt_messages_conversation ON public.mt_messages(conversation_id);
CREATE INDEX idx_mt_messages_channel ON public.mt_messages(channel_id);
CREATE INDEX idx_mt_messages_contact ON public.mt_messages(contact_id);
CREATE INDEX idx_mt_messages_provider_id ON public.mt_messages(provider_message_id);
CREATE INDEX idx_mt_messages_created ON public.mt_messages(created_at DESC);
CREATE INDEX idx_mt_messages_status ON public.mt_messages(status);

-- 9) TEMPLATES (templates aprovados pelo WhatsApp)
CREATE TABLE public.mt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id),
  provider_template_id TEXT, -- ID do template no provider
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  components JSONB NOT NULL DEFAULT '[]',
  variables_schema JSONB DEFAULT '[]',
  status template_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, language)
);

CREATE INDEX idx_mt_templates_tenant ON public.mt_templates(tenant_id);
CREATE INDEX idx_mt_templates_status ON public.mt_templates(status);
CREATE INDEX idx_mt_templates_name ON public.mt_templates(name);

-- 10) CAMPAIGNS (campanhas de disparo em massa)
CREATE TABLE public.mt_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.mt_templates(id),
  name TEXT NOT NULL,
  status campaign_status_v2 NOT NULL DEFAULT 'draft',
  template_variables JSONB DEFAULT '{}', -- variáveis fixas do template
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mt_campaigns_tenant ON public.mt_campaigns(tenant_id);
CREATE INDEX idx_mt_campaigns_status ON public.mt_campaigns(status);
CREATE INDEX idx_mt_campaigns_channel ON public.mt_campaigns(channel_id);
CREATE INDEX idx_mt_campaigns_scheduled ON public.mt_campaigns(scheduled_at);

-- 11) CAMPAIGN_RECIPIENTS (fila de envio por campanha)
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.mt_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.mt_contacts(id) ON DELETE CASCADE,
  status campaign_recipient_status NOT NULL DEFAULT 'queued',
  variables JSONB DEFAULT '{}', -- variáveis específicas do contato
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);
CREATE INDEX idx_campaign_recipients_next_retry ON public.campaign_recipients(next_retry_at) WHERE status = 'queued';

-- 12) OPT_OUTS (lista de bloqueio)
CREATE TABLE public.opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  opted_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_opt_outs_tenant ON public.opt_outs(tenant_id);
CREATE INDEX idx_opt_outs_phone ON public.opt_outs(phone);

-- 13) WEBHOOK_EVENTS (log de eventos recebidos)
CREATE TABLE public.mt_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_raw JSONB NOT NULL,
  message_id UUID REFERENCES public.mt_messages(id) ON DELETE SET NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mt_webhook_events_tenant ON public.mt_webhook_events(tenant_id);
CREATE INDEX idx_mt_webhook_events_channel ON public.mt_webhook_events(channel_id);
CREATE INDEX idx_mt_webhook_events_processed ON public.mt_webhook_events(processed);
CREATE INDEX idx_mt_webhook_events_received ON public.mt_webhook_events(received_at DESC);

-- 14) NOTES (notas internas em conversas)
CREATE TABLE public.conversation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_notes_conversation ON public.conversation_notes(conversation_id);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Função para verificar se usuário pertence ao tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id
      AND is_active = true
  )
$$;

-- Função para obter tenants do usuário
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users
  WHERE user_id = _user_id AND is_active = true
$$;

-- Função para verificar role do usuário no tenant
CREATE OR REPLACE FUNCTION public.user_has_tenant_role(_user_id UUID, _tenant_id UUID, _role tenant_user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = _user_id 
      AND tenant_id = _tenant_id
      AND role = _role
      AND is_active = true
  )
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- TENANTS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenants"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT public.get_user_tenant_ids(auth.uid())));

CREATE POLICY "Owners can update their tenants"
  ON public.tenants FOR UPDATE
  USING (public.user_has_tenant_role(auth.uid(), id, 'owner'));

-- TENANT_USERS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant members"
  ON public.tenant_users FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Owners/Admins can manage tenant members"
  ON public.tenant_users FOR ALL
  USING (
    public.user_has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.user_has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

-- PROVIDERS (public read)
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active providers"
  ON public.providers FOR SELECT
  USING (is_active = true);

-- CHANNELS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant channels"
  ON public.channels FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage channels"
  ON public.channels FOR ALL
  USING (
    public.user_has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.user_has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

-- MT_CONTACTS
ALTER TABLE public.mt_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant contacts"
  ON public.mt_contacts FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage tenant contacts"
  ON public.mt_contacts FOR ALL
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- CONVERSATIONS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant conversations"
  ON public.conversations FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage tenant conversations"
  ON public.conversations FOR ALL
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- MT_MESSAGES
ALTER TABLE public.mt_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant messages"
  ON public.mt_messages FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert tenant messages"
  ON public.mt_messages FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update tenant messages"
  ON public.mt_messages FOR UPDATE
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- MT_TEMPLATES
ALTER TABLE public.mt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant templates"
  ON public.mt_templates FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage templates"
  ON public.mt_templates FOR ALL
  USING (
    public.user_has_tenant_role(auth.uid(), tenant_id, 'owner') OR
    public.user_has_tenant_role(auth.uid(), tenant_id, 'admin')
  );

-- MT_CAMPAIGNS
ALTER TABLE public.mt_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant campaigns"
  ON public.mt_campaigns FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage tenant campaigns"
  ON public.mt_campaigns FOR ALL
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- CAMPAIGN_RECIPIENTS
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign recipients"
  ON public.campaign_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mt_campaigns c
      WHERE c.id = campaign_recipients.campaign_id
        AND public.user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
  );

CREATE POLICY "Users can manage campaign recipients"
  ON public.campaign_recipients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mt_campaigns c
      WHERE c.id = campaign_recipients.campaign_id
        AND public.user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
  );

-- OPT_OUTS
ALTER TABLE public.opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant opt-outs"
  ON public.opt_outs FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage tenant opt-outs"
  ON public.opt_outs FOR ALL
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- MT_WEBHOOK_EVENTS
ALTER TABLE public.mt_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant webhook events"
  ON public.mt_webhook_events FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- CONVERSATION_NOTES
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenant notes"
  ON public.conversation_notes FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can manage their notes"
  ON public.conversation_notes FOR ALL
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mt_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mt_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.mt_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversation_notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =============================================
-- REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mt_messages;
