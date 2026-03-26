

# Correção: Importação de Contatos + Erro de Disparo de Campanha

## Problema 1: Importação de Contatos Não Funciona

**Causa raiz**: O componente `ImportContactsWithPreview.tsx` insere contatos na tabela **legada** `contacts` (linha 392), mas o sistema multi-tenant lê da tabela `mt_contacts`. Os contatos são salvos no lugar errado e nunca aparecem.

Além disso, a IA de importação está detectando **valores** como nomes de colunas em vez dos cabeçalhos reais (log mostra: `nameColumn: "adao rodrigues"`, `phoneColumn: "11947441699"` — esses são dados, não cabeçalhos).

## Problema 2: Erro no Disparo de Campanha

**Causa raiz provável**: A Edge Function `campaign-process-queue` é chamada via `fetch` fire-and-forget (linha 635 do `campaign-start`). Se houver timeout ou falha silenciosa, o usuário vê erro genérico de "webhook". Preciso verificar se o erro está na validação do canal ou no processamento.

---

## Plano de Correção

### 1. Corrigir ImportContactsWithPreview — inserir em `mt_contacts`

**Arquivo**: `src/components/contacts/ImportContactsWithPreview.tsx`

- Linha 357-398: Trocar a inserção de `contacts` (legada) para `mt_contacts` (multi-tenant)
- Buscar `tenant_id` do usuário logado via `tenant_users`
- Usar campos corretos: `tenant_id`, `phone`, `name`, `email` (sem `user_id`, sem `import_batch_id`)
- Upsert com `onConflict: 'tenant_id,phone'`
- Invalidar queries corretas: `['mt-contacts']` e `['mt-contacts-count']`

### 2. Corrigir Edge Function smart-contact-import — detecção de colunas

**Arquivo**: `supabase/functions/smart-contact-import/index.ts`

- A IA está confundindo valores com cabeçalhos quando a planilha não tem cabeçalhos claros ou quando os dados da primeira linha são passados como "headers"
- Melhorar o prompt para diferenciar explicitamente "primeira linha = cabeçalhos" vs "primeira linha = dados"
- Adicionar fallback: se a IA retornar um valor que parece ser um telefone como `phoneColumn`, detectar isso e tentar usar índices numéricos ou heurísticas locais

### 3. Verificar e corrigir fluxo de disparo de campanha

**Arquivo**: `supabase/functions/campaign-start/index.ts`

- Adicionar logs mais detalhados no ponto de trigger do `campaign-process-queue`
- Garantir que erros do `campaign-process-queue` sejam propagados adequadamente
- Verificar se o CORS headers inclui todos os headers necessários (adicionar headers Supabase client)

### 4. Atualizar CORS em ambas Edge Functions

Os CORS headers atuais não incluem os headers do Supabase client SDK (`x-supabase-client-platform`, etc.), o que pode causar falhas de preflight.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/contacts/ImportContactsWithPreview.tsx` | Inserir em `mt_contacts` com `tenant_id` |
| `supabase/functions/smart-contact-import/index.ts` | Melhorar detecção de colunas pela IA |
| `supabase/functions/campaign-start/index.ts` | Atualizar CORS headers |
| `supabase/functions/campaign-process-queue/index.ts` | Atualizar CORS headers |

