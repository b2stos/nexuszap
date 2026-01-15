-- Adicionar coluna source para diferenciar templates Meta vs locais
ALTER TABLE public.mt_templates 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'local' 
CHECK (source IN ('meta', 'local'));

-- Adicionar coluna meta_template_id para tracking do ID do Meta
ALTER TABLE public.mt_templates 
ADD COLUMN IF NOT EXISTS meta_template_id TEXT;

-- Adicionar coluna last_synced_at para controle de sincronização
ALTER TABLE public.mt_templates 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para busca por source
CREATE INDEX IF NOT EXISTS idx_mt_templates_source ON public.mt_templates(source);

-- Criar índice para busca por provider_template_id (usado na reconciliação)
CREATE INDEX IF NOT EXISTS idx_mt_templates_provider_template_id ON public.mt_templates(provider_template_id);

-- Marcar templates existentes que têm provider_template_id como source='meta'
UPDATE public.mt_templates 
SET source = 'meta', last_synced_at = now()
WHERE provider_template_id IS NOT NULL;