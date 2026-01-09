-- ==================================================
-- STEP 10: MULTI-TENANT SECURITY + RBAC + AUDIT LOG
-- ==================================================

-- Create audit_logs table for tracking critical actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only tenant admins/owners can view audit logs
CREATE POLICY "Admins can view tenant audit logs"
ON public.audit_logs
FOR SELECT
USING (
    user_has_tenant_role(auth.uid(), tenant_id, 'owner'::tenant_user_role) OR 
    user_has_tenant_role(auth.uid(), tenant_id, 'admin'::tenant_user_role)
);

-- System can insert audit logs (for edge functions)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- ============================================
-- WEBHOOK SECURITY: Add invalid attempt tracking
-- ============================================

-- Add columns to mt_webhook_events for security tracking
ALTER TABLE public.mt_webhook_events 
ADD COLUMN IF NOT EXISTS is_invalid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invalid_reason TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS rate_limited BOOLEAN DEFAULT false;

-- Index for security monitoring
CREATE INDEX IF NOT EXISTS idx_mt_webhook_events_invalid ON public.mt_webhook_events(is_invalid, received_at DESC);

-- ============================================
-- HELPER FUNCTION: Check if user is tenant admin
-- ============================================

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
$$;

-- ============================================
-- HELPER FUNCTION: Get user's tenant role
-- ============================================

CREATE OR REPLACE FUNCTION public.get_tenant_role(_user_id UUID, _tenant_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT
  FROM public.tenant_users
  WHERE user_id = _user_id
    AND tenant_id = _tenant_id
    AND is_active = true
  LIMIT 1
$$;

-- ============================================
-- Enable realtime for audit_logs (admin monitoring)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;