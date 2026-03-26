

# Corrigir seleção de contatos na campanha — usar tabela `mt_contacts`

## Problema

O hook `useAllMTContacts` em `src/hooks/useCampaignContacts.ts` busca contatos da tabela **legada** `contacts` (linha 57), enquanto todo o sistema multi-tenant já usa `mt_contacts`. Por isso, os contatos importados/adicionados recentemente não aparecem na seleção de destinatários da campanha.

## Correção

**Arquivo**: `src/hooks/useCampaignContacts.ts`

Alterar a função `useAllMTContacts` para:
- Consultar `mt_contacts` em vez de `contacts`
- Filtrar por `tenant_id` (o parâmetro já é recebido mas ignorado)
- Filtrar `is_blocked = false`
- Incluir o campo `email` que existe em `mt_contacts`
- Atualizar a `queryKey` para incluir `tenantId`
- Habilitar a query apenas quando `tenantId` existir (`enabled: !!tenantId`)

Nenhuma alteração em outros arquivos é necessária — o componente `CampaignRecipients` já passa `tenantId` e consome o mesmo formato `CampaignContact`.

