
# Plano: Acesso Operacional para Gerentes

## Entendimento do Problema

Atualmente, existem 3 níveis de acesso:
- **Owner/Admin**: Acesso total (incluindo segurança e equipe)
- **Agent**: Acesso limitado (só Inbox e Contatos)

Você precisa de um nível intermediário: **acesso operacional completo** mas **sem acesso administrativo**.

## Solução: Promover para "Gerente"

A role `manager` já existe no sistema mas não tem as permissões configuradas. Vou ativá-la para dar acesso a:

| Funcionalidade | Agent | Manager | Admin/Owner |
|----------------|-------|---------|-------------|
| Inbox | Sim | Sim | Sim |
| Contatos | Sim | Sim | Sim |
| Templates | - | **Sim** | Sim |
| Campanhas | - | **Sim** | Sim |
| Canais | - | **Sim** | Sim |
| Configurações (básicas) | - | **Sim** | Sim |
| Gerenciar Equipe | - | - | Sim |
| Painel Admin | - | - | Sim |
| Logs de Auditoria | - | - | Sim |

## Arquivos a Modificar

### 1. Hook de Permissões (`src/hooks/useTenantRole.ts`)

Adicionar:
- `isManager` - verifica se é gerente
- `canOperate` - nova permissão para acesso operacional (owner, admin, OU manager)

```typescript
// Novo tipo expandido
export type TenantRole = "owner" | "admin" | "manager" | "agent" | null;

// Novas verificações
const isManager = context.role === "manager";
const canOperate = isSuperAdmin || isOwner || isAdmin || isManager;

// Permissões operacionais agora usam canOperate
const canManageTemplates = canOperate;
const canManageCampaigns = canOperate;
const canManageChannels = canOperate;
```

### 2. Componente de Proteção de Rotas (`src/components/auth/RequireRole.tsx`)

Adicionar prop `requireOperator`:

```typescript
interface RequireRoleProps {
  requireAdmin?: boolean;    // Owner ou Admin
  requireOperator?: boolean; // Owner, Admin, OU Manager (NOVO)
}
```

### 3. Rotas do App (`src/App.tsx`)

Trocar `requireAdmin` por `requireOperator` nas páginas operacionais:

```typescript
// Antes
<RequireRole requireAdmin redirectTo="/dashboard">

// Depois (para páginas operacionais)
<RequireRole requireOperator redirectTo="/dashboard">
```

### 4. Sidebar (`src/components/dashboard/DashboardSidebar.tsx`)

Mostrar itens operacionais para gerentes:

```typescript
// Antes
const showAdminItems = isSuperAdmin || isTenantAdmin;

// Depois
const showOperationalItems = isSuperAdmin || isTenantAdmin || canOperate;
```

### 5. Badge de Role no Sidebar

Adicionar badge para Manager:

```typescript
const config = {
  owner: { label: "Proprietário", className: "..." },
  admin: { label: "Admin", className: "..." },
  manager: { label: "Gerente", className: "bg-purple-500/10 text-purple-600" }, // NOVO
  agent: { label: "Agente", className: "..." },
};
```

## Fluxo de Promoção

1. Você acessa **Configurações → Equipe**
2. Clica no menu de ações do usuário
3. Seleciona **"Alterar função"**
4. Escolhe **"Gerente"**
5. Usuário faz login novamente
6. Tem acesso total operacional automaticamente

## Restrições Mantidas (Apenas Owner/Admin)

- Painel Administrativo (`/dashboard/admin`)
- Diagnóstico API (`/dashboard/diagnostics`)
- Logs de Auditoria (`/dashboard/audit-logs`)
- Gerenciamento de Equipe (em Configurações)
- Exclusão de membros

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTenantRole.ts` | Adicionar `isManager`, `canOperate` e exportar |
| `src/components/auth/RequireRole.tsx` | Adicionar prop `requireOperator` |
| `src/App.tsx` | Usar `requireOperator` em rotas operacionais |
| `src/components/dashboard/DashboardSidebar.tsx` | Mostrar menu para managers, badge nova |
| `src/components/settings/TeamSettings.tsx` | Já suporta manager (sem alteração) |
