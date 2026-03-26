
Diagnóstico consolidado (causa exata)
- O erro 132012 está vindo de divergência entre o que o template aprovado espera e o que o sender monta.
- No código atual, a montagem ainda é heurística em 2 pontos críticos:
  1) `supabase/functions/campaign-process-queue/index.ts` (`buildTemplateVariables`): conta placeholders, mas não valida contrato completo de `body/header/buttons`; também injeta fallback automático (ex.: primeiro nome) quando há variáveis.
  2) `supabase/functions/_shared/providers/notificame.ts` (`sendTemplate`): para botões, monta sempre `sub_type: 'url'` com `index` sequencial, sem conferir tipo/índice real do botão no template.
- Para o template `rpg5` (definição real no banco): `HEADER=IMAGE`, `BODY` sem `{{}}`, `BUTTON URL` estático.
  - Logo, o payload correto é sem `components`.
  - Qualquer `body/header/button parameter` enviado para esse template pode disparar 132012.

Erro principal a corrigir “definitivamente”
- Falta um validador pré-envio “template contract vs payload” que barre componentes indevidos e obrigue parâmetros quando realmente necessários (ex.: CTA dinâmico).

Plano de implementação
1) Criar “Template Contract Resolver” (fonte da verdade do envio)
- Arquivo: `supabase/functions/campaign-process-queue/index.ts` (helper interno + extração para `_shared/templateParams.ts`).
- Antes de enviar:
  - Buscar metadata real do template (prioridade):
    1. Meta API via `waba_id + access_token + provider_template_id/name`
    2. Fallback: `mt_templates.components` persistido.
  - Resolver contrato esperado:
    - `header`: none | text(dynamic/static) | image/video/document(dynamic/static)
    - `body`: quantidade e posições de placeholders
    - `buttons`: lista com `index`, `type`, `sub_type`, placeholders de URL, quick replies
- Resultado: objeto canônico `expectedContract`.

2) Refatorar montagem de payload para ser “contract-driven” (sem heurística solta)
- Arquivo: `supabase/functions/campaign-process-queue/index.ts`
- Regras:
  - Template sem variáveis (como `rpg5`): `variables = {}` e `components` omitido.
  - Body: só montar se `expectedContract.body.count > 0`.
  - Header:
    - não enviar `header parameters` vazios/null.
    - só enviar mídia quando `header` for dinâmico e houver URL válida.
  - Buttons:
    - montar apenas botões dinâmicos esperados.
    - usar `index` real do botão no template (não índice sequencial cego).
    - não enviar URL suffix para botão estático.
  - Remover injeção automática indevida (nome/telefone/link) quando não houver placeholder correspondente.

3) Fortalecer provider para respeitar o contrato exato
- Arquivo: `supabase/functions/_shared/providers/notificame.ts`
- Ajustes:
  - Receber estrutura de botão com `index/sub_type` explícitos.
  - Não assumir `sub_type: 'url'` para todo botão.
  - Não criar `components` quando lista final estiver vazia.
  - Ignorar/barrar parâmetros vazios (`null/undefined/''`) antes de serializar.

4) Pré-validação obrigatória com erro interno legível (antes do POST)
- Arquivo: `supabase/functions/campaign-process-queue/index.ts`
- Implementar `validatePayloadAgainstContract(expectedContract, builtPayload)`:
  - bloqueia componente não esperado;
  - bloqueia `parameters` vazios;
  - bloqueia botão dinâmico sem parâmetro obrigatório;
  - bloqueia header/body enviados quando template não exige.
- Em caso de bloqueio:
  - marcar recipient como failed com erro interno claro (`TEMPLATE_PAYLOAD_MISMATCH_PRECHECK`) e componente causador (`body|header|button`).

5) Logging de auditoria com diff componente a componente
- Arquivos: `campaign-process-queue/index.ts` e `notificame.ts`
- Logar por disparo:
  - template name + language
  - metadata real obtida da Meta (ou fallback local)
  - expectedContract
  - components finais enviados
  - diff (`missing`, `extra`, `invalid_format`) por `body/header/button`
  - quando houver mídia: URL, content-type, size, validação de acessibilidade
- Sanitizar dados sensíveis nos logs.

6) Compatibilidade garantida (sem quebrar cenários existentes)
- Cenário A: template texto puro/link estático → sem `components`.
- Cenário B: template com variável no body → envia apenas `body.parameters` necessários.
- Cenário C: template com CTA dinâmico → envia só `button.parameters` requeridos no índice correto.
- Cenário D: template com header de mídia dinâmico → envia mídia somente se válida.

Exemplo do payload correto para o template específico (`rpg5`)
- Esperado:
```json
{
  "from": "<subscription_id>",
  "to": "55XXXXXXXXXXX",
  "contents": [
    {
      "type": "template",
      "template": {
        "name": "rpg5",
        "language": { "code": "en" }
      }
    }
  ]
}
```
- Não deve conter: `template.components`, `body.parameters`, `header.parameters`, `button.parameters`.

Arquivos a ajustar
- `supabase/functions/campaign-process-queue/index.ts`
- `supabase/functions/_shared/providers/notificame.ts`
- `supabase/functions/_shared/providers/types.ts` (expandir tipagem de botão/index/sub_type)
- `supabase/functions/_shared/templateParams.ts` (parser/contrato único para body/header/button)

Validação final (E2E)
1. Disparo com `rpg5` (texto fixo + link estático) → 0 components.
2. Disparo com template de body dinâmico (`{{1}}`) → body params corretos.
3. Disparo com template de botão URL dinâmico → button param no índice correto.
4. Verificar logs de diff e ausência de 132012.
