# Nexus Zap - Documentação de Segurança

## Visão Geral

O Nexus Zap implementa múltiplas camadas de segurança para proteger dados de usuários e credenciais de API.

## Arquitetura de Segurança

### 1. Row-Level Security (RLS)

Todas as 29 tabelas do banco de dados possuem RLS habilitado com políticas restritivas.

#### Padrões de Políticas:

**User-Scoped (dados do usuário):**
```sql
-- Usuários só veem seus próprios dados
USING (auth.uid() = user_id)
```

**Tenant-Scoped (dados multi-tenant):**
```sql
-- Usuários veem dados do seu tenant
USING (user_belongs_to_tenant(auth.uid(), tenant_id))
```

**Admin-Scoped (ações administrativas):**
```sql
-- Apenas owners/admins podem gerenciar
USING (user_has_tenant_role(auth.uid(), tenant_id, 'admin'))
```

### 2. Funções SECURITY DEFINER

Todas as funções de verificação de permissão usam `SECURITY DEFINER` com `search_path` definido para prevenir SQL injection:

```sql
CREATE FUNCTION user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = public
```

### 3. Multi-Tenant Isolation

- Cada tenant possui seus próprios dados isolados
- Verificações de tenant_id em todas as queries
- Funções auxiliares validam membership ativo

### 4. Gerenciamento de Credenciais

#### Credenciais de API:

| Tipo | Armazenamento | Acesso |
|------|---------------|--------|
| NotificaMe Token | `channels.provider_config` | RLS + Tenant Admin only |
| Meta Access Token | `channels.provider_config` | RLS + Tenant Admin only |
| WABA ID | `channels.provider_config` | RLS + Tenant Users |

#### Recomendações:

1. **Nunca** expor tokens no frontend
2. Usar Edge Functions para chamadas de API
3. Rotacionar tokens periodicamente
4. Monitorar audit logs para acessos suspeitos

### 5. Proteção de Senhas

**Status:** Leaked Password Protection pode ser habilitado no Lovable Cloud.

**Configuração atual:**
- Mínimo 8 caracteres
- Validação client-side com zod
- Server-side via Supabase Auth

### 6. Edge Functions Security

Todas as Edge Functions validam:

1. Autenticação JWT
2. Membership do tenant
3. Permissões de role
4. Sanitização de inputs

```typescript
// Exemplo de validação
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Unauthorized');

const tenantUser = await supabase
  .from('tenant_users')
  .select('tenant_id, role')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single();
```

### 7. Webhooks

- Validação de assinatura HMAC-SHA256
- Rate limiting (100 req/min por canal)
- Sanitização de payloads
- Logging de tentativas inválidas

## Rotação de Credenciais

### Como rotacionar tokens:

1. **NotificaMe:**
   - Gere novo token no painel NotificaMe
   - Atualize em Canais → Configurações
   - Token antigo é substituído imediatamente

2. **Meta Access Token:**
   - Gere System User Token no Meta Business Suite
   - Atualize WABA ID e Token no canal
   - Sincronize templates após atualização

### Frequência recomendada:
- Tokens de produção: a cada 90 dias
- Após qualquer suspeita de vazamento: imediatamente

## Audit Trail

Ações auditadas:
- Criação/edição de canais
- Criação/edição de templates
- Início de campanhas
- Exclusão de usuários
- Alterações de permissões

Acesso: Owners e Admins via `/dashboard/audit-logs`

## Checklist de Segurança

### Configuração Inicial:
- [ ] Habilitar Leaked Password Protection no Cloud
- [ ] Configurar WEBHOOK_SECRET para webhooks
- [ ] Verificar RLS em todas as tabelas (automático)

### Operacional:
- [ ] Rotacionar tokens a cada 90 dias
- [ ] Revisar audit logs semanalmente
- [ ] Remover usuários inativos

### Desenvolvimento:
- [ ] Nunca logar tokens ou senhas
- [ ] Usar Edge Functions para APIs externas
- [ ] Validar inputs com zod

## Contato

Para reportar vulnerabilidades: security@nexuszap.online
