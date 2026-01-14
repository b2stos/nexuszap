-- Add unique constraint on mt_contacts for safe upsert by tenant_id + phone
-- This enables ON CONFLICT (tenant_id, phone) DO UPDATE

ALTER TABLE public.mt_contacts 
ADD CONSTRAINT mt_contacts_tenant_phone_unique 
UNIQUE (tenant_id, phone);