
# Correção: Menu Lateral Incompleto para Administradores

## Problema Identificado

O usuário **Vinicius de Luca** fez login mas **não está associado ao tenant** na tabela `tenant_users`. Por isso:

| Estado Atual | Resultado |
|--------------|-----------|
| `tenant_users.role` = `null` | `canOperate = false` |
| Sem role atribuída | Menu limitado: Dashboard, Inbox, Contatos |

O sistema está funcionando corretamente - o problema é que **novos usuários que fazem login não são automaticamente adicionados ao tenant**.

## Solução em 2 Partes

### Parte 1: Corrigir Usuário Atual (Manual Imediato)

Preciso adicionar Vinicius ao tenant com a role `admin`:

```sql
INSERT INTO tenant_users (user_id, tenant_id, role, is_active)
VALUES (
  'ff862a0f-b3bc-4bce-a336-2a65080a68c6',  -- Vinicius
  'a41b6943-af92-4894-9c59-bf8d9f42fe3e',  -- Empresa Principal
  'admin',
  true
);
```

### Parte 2: Auto-Atribuição para Novos Usuários

Criar um trigger que automaticamente associa novos usuários ao tenant com role `manager`:

```sql
-- Função que associa automaticamente novos usuários
CREATE OR REPLACE FUNCTION auto_assign_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Buscar o primeiro tenant ativo
  INSERT INTO tenant_users (user_id, tenant_id, role, is_active)
  SELECT 
    NEW.id,
    t.id,
    'manager',  -- Role operacional padrão
    true
  FROM tenants t
  WHERE t.status = 'active'
  LIMIT 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger ao criar novo profile
CREATE TRIGGER on_profile_created_assign_tenant
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_tenant();
```

## Hierarquia de Acesso Atualizada

| Role | Menu Lateral | Sistema |
|------|--------------|---------|
| **Agent** | Dashboard, Inbox, Contatos | - |
| **Manager** | + Templates, Campanhas, Canais, Configurações | - |
| **Admin** | + Logs de Auditoria | - |
| **Owner** | Tudo | - |
| **Super Admin** (você) | Tudo | Administração, Diagnóstico API |

## Seção "Sistema" - Apenas Super Admin

A lógica atual já está correta:

```typescript
// DashboardSidebar.tsx - linha 93
const showSystemAdmin = isSuperAdmin || isAppAdmin;
```

Onde `isSuperAdmin` é verificado pelo email `bbastosb2@gmail.com` configurado em `src/utils/superAdmin.ts`.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Adicionar Vinicius ao tenant + criar trigger de auto-atribuição |

## Benefício

Após esta correção:
1. **Vinicius** verá o menu completo imediatamente
2. **Novos usuários** que fizerem login serão automaticamente atribuídos como `manager`
3. Você pode promover/rebaixar via Configurações → Equipe
4. A seção "Sistema" continuará aparecendo **apenas para você**
