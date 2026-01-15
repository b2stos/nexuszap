-- ===========================================
-- Migração 1: User Settings + Roles Expandidos (sem função)
-- ===========================================

-- 1) Expandir enum de roles para tenant_users
ALTER TYPE public.tenant_user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.tenant_user_role ADD VALUE IF NOT EXISTS 'marketing';
ALTER TYPE public.tenant_user_role ADD VALUE IF NOT EXISTS 'attendant';
ALTER TYPE public.tenant_user_role ADD VALUE IF NOT EXISTS 'readonly';

-- 2) Criar tabela user_settings para persistir preferências
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  
  -- Aparência
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  accent_color text NOT NULL DEFAULT 'cyan' CHECK (accent_color IN ('cyan', 'blue', 'purple', 'green', 'orange', 'red', 'pink', 'slate')),
  
  -- Dashboard Widgets (JSON array of widget ids that are enabled)
  dashboard_widgets jsonb NOT NULL DEFAULT '["onboarding", "metrics", "webhooks", "campaigns"]'::jsonb,
  
  -- Notificações
  notify_campaign_complete boolean NOT NULL DEFAULT true,
  notify_send_failure boolean NOT NULL DEFAULT true,
  notify_new_message boolean NOT NULL DEFAULT true,
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3) Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies - cada usuário gerencia suas próprias configs
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 5) Trigger para updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_updated_at();

-- 6) Criar índice
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);