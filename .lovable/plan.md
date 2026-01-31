
# Plano: Adicionar Opção de Excluir Templates Sincronizados

## Contexto
A página de Templates (`/dashboard/templates`) exibe templates sincronizados da Meta, mas não possui opção para remover templates que o usuário não deseja mais utilizar. O hook `useDeleteTemplate` já existe e está funcional.

---

## Implementação

### 1. Adicionar Botão de Excluir na Tabela

Na coluna de ações de cada template, adicionar um botão de lixeira ao lado do botão de revalidar:

- Ícone: `Trash2` do lucide-react
- Tooltip: "Excluir template"
- Cor: vermelho sutil para indicar ação destrutiva

### 2. Dialog de Confirmação

Criar um `AlertDialog` para confirmar a exclusão antes de executar:

- Título: "Excluir template?"
- Descrição: Nome do template + aviso que a exclusão é local e não afeta a Meta
- Botão cancelar: "Cancelar"
- Botão confirmar: "Excluir" (vermelho)

### 3. Integrar Hook de Exclusão

Utilizar o hook existente `useDeleteTemplate()`:

```typescript
const deleteTemplate = useDeleteTemplate();

const handleDelete = (templateId: string) => {
  deleteTemplate.mutate({ 
    tenantId: tenantData.tenantId, 
    templateId 
  });
};
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Templates.tsx` | Adicionar botão delete, dialog de confirmação, e lógica de exclusão |

---

## Fluxo do Usuário

```text
1. Usuário visualiza lista de templates
2. Clica no ícone de lixeira (🗑️) do template
3. Dialog aparece: "Excluir template 'nome_template'?"
4. Confirma → Template removido da lista local
5. Toast de sucesso: "Template excluído com sucesso"
```

---

## Observações Importantes

- **Exclusão local apenas**: O template será removido do banco de dados do Nexus Zap, mas continuará existindo na conta Meta/WABA
- **Ressincronização**: Se o usuário sincronizar novamente, templates excluídos voltarão a aparecer
- **Sem impacto em campanhas**: Campanhas já criadas não serão afetadas

---

## Detalhes Técnicos

**Novos imports necessários:**
- `Trash2` de lucide-react
- `AlertDialog` componentes de @/components/ui/alert-dialog

**Estado adicional:**
- `templateToDelete: Template | null` - controlar qual template será excluído

**Validação:**
- Desabilitar botão delete durante operação de exclusão
- Mostrar loading no botão durante mutação
