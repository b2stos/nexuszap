-- Tornar template_id nullable para campanhas antigas (já concluídas)
ALTER TABLE public.mt_campaigns 
ALTER COLUMN template_id DROP NOT NULL;