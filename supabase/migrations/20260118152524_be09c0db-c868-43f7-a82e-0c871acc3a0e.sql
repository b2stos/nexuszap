-- Remover a FK problemática que causa erro ao salvar webhook events
-- O campo message_id era para referir mt_messages.id, mas recebe provider_message_id (string do provedor)
-- Isso causa erro: "violates foreign key constraint mt_webhook_events_message_id_fkey"

ALTER TABLE public.mt_webhook_events
DROP CONSTRAINT IF EXISTS mt_webhook_events_message_id_fkey;

-- Adicionar coluna para guardar provider_message_id separadamente (mais útil para correlação)
COMMENT ON COLUMN public.mt_webhook_events.message_id IS 'Provider message ID from webhook payload (NOT a FK to mt_messages)';

-- Adicionar índice para busca por provider_message_id
CREATE INDEX IF NOT EXISTS idx_mt_webhook_events_message_id ON public.mt_webhook_events(message_id);

-- Adicionar índice composto para busca por tenant + canal + tempo
CREATE INDEX IF NOT EXISTS idx_mt_webhook_events_tenant_channel_time 
ON public.mt_webhook_events(tenant_id, channel_id, received_at DESC);