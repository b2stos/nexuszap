
# Plano: Adicionar Contato Manual na Campanha e Contatos

## Contexto
O usuário quer poder adicionar contatos manualmente em dois lugares:
1. **Na tela de criar campanha** - ao selecionar destinatários
2. **Na página de Contatos** - além da importação via arquivo

Atualmente existe um `AddContactDialog` que usa a tabela `contacts` (legacy). Precisamos criar um novo componente que use a tabela `mt_contacts` (multi-tenant) para manter consistência com o sistema.

---

## Implementação

### 1. Criar Componente `AddMTContactDialog`

Novo dialog reutilizável para adicionar contatos na tabela `mt_contacts`:

| Campo | Validação |
|-------|-----------|
| Nome | Obrigatório, 1-100 caracteres |
| Telefone | 10-15 dígitos, formato WhatsApp (DDI + número) |
| Email | Opcional, formato email válido |

**Funcionalidades:**
- Validação com Zod
- Normalização automática do telefone (remove caracteres não numéricos)
- Toast de sucesso/erro
- Invalida cache do React Query após sucesso

### 2. Adicionar Botão no `CampaignRecipients`

Na seção de seleção de contatos, adicionar botão "Adicionar Contato" ao lado das ações rápidas:

```text
┌─────────────────────────────────────────────────────────┐
│  Destinatários                                          │
├─────────────────────────────────────────────────────────┤
│  [Selecionar até limite] [Limpar] [+ Adicionar Contato] │
│                                                         │
│  🔍 Buscar por nome ou telefone...                      │
│                                                         │
│  Lista de contatos...                                   │
└─────────────────────────────────────────────────────────┘
```

### 3. Atualizar `ContactsHeader` 

Substituir o `AddContactDialog` pelo novo `AddMTContactDialog` para usar a tabela multi-tenant correta.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/contacts/AddMTContactDialog.tsx` | **NOVO** - Dialog reutilizável |
| `src/components/campaigns/CampaignRecipients.tsx` | Adicionar botão e dialog |
| `src/components/contacts/ContactsHeader.tsx` | Usar novo dialog MT |
| `src/hooks/useCampaignContacts.ts` | Invalidar query correta após adicionar |

---

## Fluxo do Usuário

**Na Campanha:**
```text
1. Usuário cria campanha → Chega na aba de destinatários
2. Clica em "+ Adicionar Contato"
3. Dialog abre → Preenche nome e telefone
4. Clica "Adicionar" → Contato aparece na lista
5. Seleciona o contato → Continua criando campanha
```

**Na Página de Contatos:**
```text
1. Usuário acessa Contatos
2. Clica em "Adicionar Contato"
3. Dialog abre → Preenche dados
4. Contato aparece na tabela
```

---

## Detalhes Técnicos

**Novo componente `AddMTContactDialog`:**
```typescript
interface AddMTContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess?: (contact: MTContact) => void; // Callback opcional
}
```

**Schema de validação:**
```typescript
const mtContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(10).max(15).regex(/^[0-9]+$/),
  email: z.string().email().optional().or(z.literal('')),
});
```

**Invalidação de cache:**
```typescript
queryClient.invalidateQueries({ queryKey: ['mt-contacts', tenantId] });
queryClient.invalidateQueries({ queryKey: ['all-contacts-for-campaign-paginated'] });
```

---

## Observações

- O telefone será normalizado (só números) antes de salvar
- Se o contato já existir (mesmo telefone no tenant), será feito upsert
- O novo contato ficará imediatamente disponível para seleção na campanha
