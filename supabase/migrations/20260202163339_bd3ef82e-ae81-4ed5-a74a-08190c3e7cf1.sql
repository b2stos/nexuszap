-- Parte 1: Adicionar Vinicius ao tenant como admin
INSERT INTO tenant_users (user_id, tenant_id, role, is_active)
VALUES (
  'ff862a0f-b3bc-4bce-a336-2a65080a68c6',
  'a41b6943-af92-4894-9c59-bf8d9f42fe3e',
  'admin',
  true
)
ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'admin', is_active = true;

-- Parte 2: Criar função para auto-atribuição de novos usuários
CREATE OR REPLACE FUNCTION public.auto_assign_tenant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_users (user_id, tenant_id, role, is_active)
  SELECT 
    NEW.id,
    t.id,
    'manager',
    true
  FROM public.tenants t
  WHERE t.status = 'active'
  LIMIT 1
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Parte 3: Criar trigger para executar após criação de profile
DROP TRIGGER IF EXISTS on_profile_created_assign_tenant ON public.profiles;
CREATE TRIGGER on_profile_created_assign_tenant
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_tenant();