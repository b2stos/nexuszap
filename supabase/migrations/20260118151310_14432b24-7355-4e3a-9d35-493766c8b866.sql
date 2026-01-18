-- ============================================
-- NEXUS ZAP: Correção de Envio e Bloqueio por Erro 131042
-- ============================================

-- 1. Adicionar campos de bloqueio no canal
ALTER TABLE public.channels
ADD COLUMN IF NOT EXISTS blocked_by_provider BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_error_code TEXT;

-- 2. Adicionar campos de rastreabilidade em campaign_recipients
ALTER TABLE public.campaign_recipients
ADD COLUMN IF NOT EXISTS correlation_id UUID,
ADD COLUMN IF NOT EXISTS provider_error_code TEXT,
ADD COLUMN IF NOT EXISTS provider_error_message TEXT,
ADD COLUMN IF NOT EXISTS provider_request_id TEXT;

-- 3. Adicionar índice para busca por correlation_id
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_correlation_id 
ON public.campaign_recipients(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- 4. Adicionar índice para busca por provider_message_id (otimizar webhooks)
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_provider_message_id
ON public.campaign_recipients(provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- 5. Adicionar campos de observabilidade em mt_messages
ALTER TABLE public.mt_messages
ADD COLUMN IF NOT EXISTS correlation_id UUID,
ADD COLUMN IF NOT EXISTS provider_request_id TEXT;

-- 6. Criar índice para busca por correlation_id em mt_messages
CREATE INDEX IF NOT EXISTS idx_mt_messages_correlation_id
ON public.mt_messages(correlation_id)
WHERE correlation_id IS NOT NULL;

-- 7. Adicionar campos de erro detalhado em mt_webhook_events
ALTER TABLE public.mt_webhook_events
ADD COLUMN IF NOT EXISTS provider_error_code TEXT,
ADD COLUMN IF NOT EXISTS provider_error_message TEXT,
ADD COLUMN IF NOT EXISTS affects_channel_status BOOLEAN DEFAULT FALSE;

-- 8. Atualizar campo provider_error_code nos webhooks existentes com erro 131042
UPDATE public.mt_webhook_events
SET 
  provider_error_code = '131042',
  provider_error_message = 'Business eligibility payment issue',
  affects_channel_status = TRUE
WHERE 
  payload_raw::text LIKE '%131042%'
  AND provider_error_code IS NULL;

-- 9. Comentários de documentação
COMMENT ON COLUMN public.channels.blocked_by_provider IS 'Canal bloqueado pelo provedor (ex: erro 131042 de pagamento)';
COMMENT ON COLUMN public.channels.blocked_reason IS 'Motivo do bloqueio do canal';
COMMENT ON COLUMN public.channels.blocked_error_code IS 'Código de erro que causou o bloqueio (ex: 131042)';
COMMENT ON COLUMN public.campaign_recipients.correlation_id IS 'ID único para rastreabilidade ponta-a-ponta';
COMMENT ON COLUMN public.campaign_recipients.provider_error_code IS 'Código de erro retornado pelo provedor';
COMMENT ON COLUMN public.campaign_recipients.provider_error_message IS 'Mensagem de erro do provedor';