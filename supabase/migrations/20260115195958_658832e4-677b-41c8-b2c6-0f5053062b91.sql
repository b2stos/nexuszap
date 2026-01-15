-- ============================================
-- SECURITY HARDENING MIGRATION
-- Fix RLS policies to deny public/unauthenticated access
-- ============================================

-- 1. UAZAPI_CONFIG: Add policy to deny unauthenticated access
-- This table contains sensitive API tokens
DROP POLICY IF EXISTS "Deny public access to uazapi_config" ON public.uazapi_config;
CREATE POLICY "Deny public access to uazapi_config"
  ON public.uazapi_config
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 2. CONTACTS: Add policy to deny unauthenticated access  
-- This table contains customer PII (names, phone numbers)
DROP POLICY IF EXISTS "Deny public access to contacts" ON public.contacts;
CREATE POLICY "Deny public access to contacts"
  ON public.contacts
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. WHATSAPP_CONFIG: Ensure tokens are protected
-- Contains access_token_encrypted and sensitive business IDs
DROP POLICY IF EXISTS "Deny public access to whatsapp_config" ON public.whatsapp_config;
CREATE POLICY "Deny public access to whatsapp_config"
  ON public.whatsapp_config
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. WHATSAPP_TEMPLATES: User-specific templates
DROP POLICY IF EXISTS "Deny public access to whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "Deny public access to whatsapp_templates"
  ON public.whatsapp_templates
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 5. CAMPAIGNS: User campaigns are private
DROP POLICY IF EXISTS "Deny public access to campaigns" ON public.campaigns;
CREATE POLICY "Deny public access to campaigns"
  ON public.campaigns
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. MESSAGES: Campaign messages contain content
DROP POLICY IF EXISTS "Deny public access to messages" ON public.messages;
CREATE POLICY "Deny public access to messages"
  ON public.messages
  FOR ALL
  USING (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.campaigns c 
    WHERE c.id = messages.campaign_id AND c.user_id = auth.uid()
  ));

-- 7. WEBHOOK_EVENTS: May contain sensitive payload data
DROP POLICY IF EXISTS "Deny public access to webhook_events" ON public.webhook_events;
CREATE POLICY "Deny public access to webhook_events"
  ON public.webhook_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 8. PROFILES: User profiles should only be accessible to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 9. USER_ROLES: Critical security table - restrict access
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Only admins can modify roles (via has_role function)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 10. USER_SETTINGS: Personal settings are private
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings"
  ON public.user_settings
  FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 11. CAMPAIGN_SEND_ATTEMPTS: Debugging data - restrict to tenant users
DROP POLICY IF EXISTS "Tenant users can view send attempts" ON public.campaign_send_attempts;
CREATE POLICY "Tenant users can view send attempts"
  ON public.campaign_send_attempts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    (tenant_id IS NULL OR user_belongs_to_tenant(auth.uid(), tenant_id))
  );

-- ============================================
-- ADDITIONAL SECURITY: Ensure RLS is enabled on all tables
-- ============================================

ALTER TABLE public.uazapi_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_send_attempts ENABLE ROW LEVEL SECURITY;