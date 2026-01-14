-- Tabela para logs persistentes de tentativas de envio de campanha
-- Permite diagnóstico mesmo quando frontend não captura erro

CREATE TABLE IF NOT EXISTS public.campaign_send_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.mt_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  template_name TEXT,
  step TEXT NOT NULL DEFAULT 'start', -- start, validate_channel, build_payload, call_provider, complete
  request_payload JSONB,
  provider_status INTEGER,
  provider_response_raw TEXT,
  error_code TEXT,
  error_message TEXT,
  error_stack TEXT,
  recipients_count INTEGER,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para busca por trace_id
CREATE INDEX IF NOT EXISTS idx_campaign_send_attempts_trace_id ON public.campaign_send_attempts(trace_id);

-- Index para busca por campanha
CREATE INDEX IF NOT EXISTS idx_campaign_send_attempts_campaign_id ON public.campaign_send_attempts(campaign_id);

-- Index para busca por tenant
CREATE INDEX IF NOT EXISTS idx_campaign_send_attempts_tenant_id ON public.campaign_send_attempts(tenant_id);

-- Enable RLS
ALTER TABLE public.campaign_send_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver logs do seu tenant
CREATE POLICY "Users can view campaign attempts of their tenant" 
ON public.campaign_send_attempts 
FOR SELECT 
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.tenant_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_campaign_send_attempts_updated_at
  BEFORE UPDATE ON public.campaign_send_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();