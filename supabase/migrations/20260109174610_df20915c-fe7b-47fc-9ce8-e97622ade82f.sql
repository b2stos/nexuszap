-- Create tenant onboarding table to track progress
CREATE TABLE public.tenant_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Step completion timestamps
  welcome_completed_at TIMESTAMP WITH TIME ZONE,
  channel_connected_at TIMESTAMP WITH TIME ZONE,
  template_created_at TIMESTAMP WITH TIME ZONE,
  first_message_sent_at TIMESTAMP WITH TIME ZONE,
  inbox_opened_at TIMESTAMP WITH TIME ZONE,
  
  -- Overall completion
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT tenant_onboarding_tenant_unique UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own tenant's onboarding
CREATE POLICY "Users can view their tenant onboarding"
  ON public.tenant_onboarding
  FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can insert their tenant onboarding"
  ON public.tenant_onboarding
  FOR INSERT
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can update tenant onboarding"
  ON public.tenant_onboarding
  FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Trigger for updated_at
CREATE TRIGGER update_tenant_onboarding_updated_at
  BEFORE UPDATE ON public.tenant_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

-- Create index for performance
CREATE INDEX idx_tenant_onboarding_tenant_id ON public.tenant_onboarding(tenant_id);

-- Auto-create onboarding record when tenant is created
CREATE OR REPLACE FUNCTION public.create_tenant_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_onboarding (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_tenant_created_create_onboarding
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tenant_onboarding();

-- Create onboarding records for existing tenants
INSERT INTO public.tenant_onboarding (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;