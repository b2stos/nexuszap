
# Correção Definitiva: Erro 132012 — Contract-Driven Template Dispatch

## Status: ✅ IMPLEMENTADO

## Causa Raiz

O sistema montava o payload de templates de forma **heurística** — contava placeholders `{{N}}` e injetava parâmetros automaticamente (ex.: nome do contato). Para templates como `rpg5` (HEADER=IMAGE estático, BODY sem variáveis, BUTTON URL estático), qualquer parâmetro enviado causava erro **132012** da Meta.

## Solução: Template Contract Resolver

Criado um **resolvedor de contrato canônico** (`resolveTemplateContract`) que analisa os `components` do template e produz um objeto descrevendo **exatamente** o que a Meta espera:

```typescript
interface TemplateContract {
  header: { type, dynamicParams, isMediaStatic };
  body:   { dynamicParams, paramNames };
  buttons: Array<{ index, type, hasDynamicParam }>;
  totalDynamicParams: number;
}
```

### Regras aplicadas:
- `totalDynamicParams === 0` → payload **sem** `components` (limpo)
- Body com N params → envia **exatamente** N params
- Botões: só envia params para botões **dinâmicos** (com `{{1}}` na URL)
- Header IMAGE/VIDEO/DOCUMENT estático → **não** envia componente header
- Validação pré-envio bloqueia payload inválido antes do POST

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/templateParams.ts` | Adicionado `resolveTemplateContract()` + `TemplateContract` |
| `supabase/functions/_shared/providers/types.ts` | Adicionado `buttonMeta` ao `SendTemplateRequest` |
| `supabase/functions/campaign-process-queue/index.ts` | Substituído `buildTemplateVariables` por `buildTemplateVariablesFromContract` + validação pré-envio |
| `supabase/functions/_shared/providers/notificame.ts` | Botões usam `buttonMeta` explícito; componentes vazios filtrados; audit logging |

## Exemplo: Template `rpg5` (texto fixo + link estático)

**Payload enviado (correto):**
```json
{
  "from": "<subscription_id>",
  "to": "55XXXXXXXXXXX",
  "contents": [{
    "type": "template",
    "template": {
      "name": "rpg5",
      "language": { "code": "en" }
    }
  }]
}
```

Sem `template.components` — a Meta não espera nenhum parâmetro.
