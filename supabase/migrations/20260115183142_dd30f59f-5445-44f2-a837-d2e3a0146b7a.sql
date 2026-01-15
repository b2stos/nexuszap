-- ===========================================
-- Migração 2: Função de permissão por módulo
-- ===========================================

-- Função helper para verificar permissão de módulo
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid, 
  _tenant_id uuid, 
  _module text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = _user_id 
      AND tu.tenant_id = _tenant_id
      AND tu.is_active = true
      AND (
        -- Owner e Admin têm acesso total
        tu.role IN ('owner', 'admin')
        OR
        -- Manager tem acesso a tudo exceto configurações de tenant
        (tu.role = 'manager' AND _module != 'tenant_settings')
        OR
        -- Marketing tem acesso a campanhas, templates, contatos
        (tu.role = 'marketing' AND _module IN ('campaigns', 'templates', 'contacts'))
        OR
        -- Agent/Attendant tem acesso a inbox e contatos
        (tu.role IN ('agent', 'attendant') AND _module IN ('inbox', 'contacts'))
        OR
        -- Readonly pode ver tudo mas não modificar
        tu.role = 'readonly'
      )
  )
$$;