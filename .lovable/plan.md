
# Plano: Filtrar Inbox para Mostrar Apenas Quem Respondeu

## Problema
Ao fazer disparos em massa (ex: 250 contatos), o Inbox fica cheio de conversas onde o contato **nunca respondeu**, dificultando encontrar quem realmente quer conversar.

## Solução
Adicionar novo filtro **"Respondidas"** que mostra apenas conversas onde o contato enviou pelo menos uma mensagem. Este será o filtro **padrão** para facilitar o atendimento.

---

## Interface Proposta

```text
┌─────────────────────────────────────────┐
│ 💬 Conversas                        [5] │
├─────────────────────────────────────────┤
│ 🔍 Buscar por nome ou telefone...       │
├─────────────────────────────────────────┤
│ [Respondidas] [Não lidas] [Todas]       │  ← NOVO filtro padrão
│     ativo                               │
├─────────────────────────────────────────┤
│ ✅ João Silva        ← contato respondeu│
│    Oi, recebi a mensagem!     10:30     │
│                                         │
│ ✅ Maria Santos      ← contato respondeu│
│    Quero saber mais           09:45     │
│                                         │
│ (contatos que não responderam ficam     │
│  visíveis apenas no filtro "Todas")     │
└─────────────────────────────────────────┘
```

---

## Alterações Técnicas

### 1. Atualizar Tipo `ConversationFilter`

**Arquivo:** `src/types/inbox.ts`

```typescript
export interface ConversationFilter {
  search: string;
  unreadOnly: boolean;
  status?: 'open' | 'resolved' | 'all';
  repliedOnly?: boolean; // NOVO: apenas conversas com resposta do contato
}
```

### 2. Atualizar Hook `useConversations`

**Arquivo:** `src/hooks/useInbox.ts`

Adicionar filtro que verifica se `last_inbound_at` não é nulo:

```typescript
// Filtro de respondidas (contato enviou pelo menos 1 mensagem)
if (filter.repliedOnly) {
  query = query.not('last_inbound_at', 'is', null);
}
```

### 3. Atualizar UI `ConversationList`

**Arquivo:** `src/components/inbox/ConversationList.tsx`

- Alterar ordem dos botões: **Respondidas | Não lidas | Todas**
- Mudar rótulo "Ativas" para "Respondidas"
- Aplicar filtro `repliedOnly: true` ao clicar

### 4. Mudar Filtro Padrão na Página Inbox

**Arquivo:** `src/pages/Inbox.tsx`

Inicializar estado com `repliedOnly: true`:

```typescript
const [filter, setFilter] = useState<ConversationFilter>({
  search: '',
  unreadOnly: false,
  status: 'all',
  repliedOnly: true, // PADRÃO: só quem respondeu
});
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/types/inbox.ts` | Adicionar campo `repliedOnly` ao tipo |
| `src/hooks/useInbox.ts` | Filtrar por `last_inbound_at IS NOT NULL` |
| `src/components/inbox/ConversationList.tsx` | Novos botões de filtro |
| `src/pages/Inbox.tsx` | Mudar filtro padrão para `repliedOnly: true` |

---

## Fluxo do Usuário

```text
1. Faz disparo para 250 contatos
2. Abre Inbox
3. Vê apenas 5 conversas (quem respondeu) ← COMPORTAMENTO NOVO
4. Atende os contatos interessados facilmente
5. Se quiser ver todos, clica em "Todas"
6. Vê os 250 contatos para acompanhamento
```

---

## Benefícios

- **Foco no atendimento**: Apenas conversas que precisam de resposta
- **Performance**: Menos itens para renderizar na lista
- **Flexibilidade**: Filtro "Todas" permite ver histórico completo quando necessário
- **Compatível**: Não quebra funcionalidade existente, apenas muda o padrão
