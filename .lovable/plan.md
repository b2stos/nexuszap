

# Correção: Erro 132012 em Templates com Header de Imagem

## Causa Raiz Identificada

O template `rpg3` tem um **HEADER com formato IMAGE** (foto) que a Meta exige que seja enviado como componente, mesmo sem variáveis de texto `{{1}}`.

Dados do template no banco:
```
components: [
  { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://...jpg"] } },
  { type: "BODY", text: "Olá, tudo bem? ..." },
  { type: "BUTTONS", buttons: [{ type: "URL", url: "https://www.rpgcred.com.br/" }] }
]
```

A função `countTemplateVariablesFromComponents` conta apenas placeholders `{{N}}` em textos. Como o HEADER é uma imagem (sem texto com `{{N}}`), retorna `total=0`. O sistema então envia o template **sem nenhum componente**, mas a Meta **exige** que o header IMAGE seja enviado com o parâmetro de mídia. Resultado: erro 132012.

## Correção

### 1. Atualizar `countTemplateVariablesFromComponents` no `campaign-process-queue/index.ts`

Detectar headers com formato IMAGE/VIDEO/DOCUMENT como variáveis obrigatórias, além dos placeholders `{{N}}`.

### 2. Atualizar `buildTemplateVariables` no `campaign-process-queue/index.ts`

Quando o template tem header de mídia:
- Extrair a URL da imagem do campo `example.header_handle[0]` do componente HEADER
- Montar o componente header com o parâmetro de mídia (tipo `image`, `video` ou `document`)
- Enviar como parte do `variables` passado ao provider

### 3. Atualizar `sendTemplate` no `notificame.ts`

Garantir que quando `variables.header` contém um parâmetro de mídia (type=image/video/document), o componente header seja montado corretamente — sem duplicar com a lógica de `media` que já existe.

### 4. Corrigir também `countTemplateVariables` no `_shared/templateParams.ts`

Manter consistência entre a versão inline e a compartilhada.

## Lógica de Decisão

```text
Template HEADER format:
  TEXT com {{N}}  → enviar header text params (já funciona)
  IMAGE           → enviar header image param com URL da example
  VIDEO           → enviar header video param com URL da example  
  DOCUMENT        → enviar header document param com URL da example
  TEXT sem {{N}}  → não enviar header (já funciona)
  Ausente         → não enviar header (já funciona)

Template BODY:
  Com {{N}}       → enviar body params (já funciona)
  Sem {{N}}       → não enviar body params (já funciona)
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/campaign-process-queue/index.ts` | Detectar headers de mídia + montar componente header com URL da imagem |
| `supabase/functions/_shared/providers/notificame.ts` | Suportar header de mídia vindo de `variables.header` com tipo image/video/document |
| `supabase/functions/_shared/templateParams.ts` | Atualizar `countTemplateVariables` para consistência |

## Segurança

- Templates sem variáveis E sem header de mídia continuam enviando sem components (sem regressão)
- Templates com variáveis de texto continuam funcionando normalmente
- Apenas templates com header IMAGE/VIDEO/DOCUMENT ganham o componente adicional

