-- 1. Remover Vinicius do tenant "Empresa Principal"
DELETE FROM tenant_users 
WHERE user_id = 'ff862a0f-b3bc-4bce-a336-2a65080a68c6' 
  AND tenant_id = 'a41b6943-af92-4894-9c59-bf8d9f42fe3e';

-- 2. Criar um tenant próprio para Vinicius
INSERT INTO tenants (id, name, slug, status)
VALUES (
  gen_random_uuid(),
  'Workspace de Vinicius',
  'vinicius-' || substr(md5(random()::text), 1, 8),
  'active'
)
RETURNING id;

-- 3. Adicionar Vinicius ao seu próprio tenant como owner
INSERT INTO tenant_users (user_id, tenant_id, role, is_active)
SELECT 
  'ff862a0f-b3bc-4bce-a336-2a65080a68c6',
  t.id,
  'owner',
  true
FROM tenants t
WHERE t.name = 'Workspace de Vinicius'
LIMIT 1;

-- 4. Atualizar a função para criar um tenant NOVO para cada usuário
CREATE OR REPLACE FUNCTION public.auto_assign_tenant()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id uuid;
  user_name text;
BEGIN
  -- Buscar nome do usuário
  user_name := COALESCE(NEW.full_name, split_part(NEW.email, '@', 1));
  
  -- Criar um NOVO tenant para o usuário
  INSERT INTO public.tenants (name, slug, status)
  VALUES (
    'Workspace de ' || user_name,
    'ws-' || substr(md5(NEW.id::text || now()::text), 1, 12),
    'active'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Adicionar usuário ao seu próprio tenant como owner
  INSERT INTO public.tenant_users (user_id, tenant_id, role, is_active)
  VALUES (NEW.id, new_tenant_id, 'owner', true)
  ON CONFLICT (user_id, tenant_id) DO NOTHING;
  
  -- Criar onboarding para o novo tenant
  INSERT INTO public.tenant_onboarding (tenant_id)
  VALUES (new_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;