# Webhook NotificaMe BSP

Endpoint público para receber eventos do WhatsApp via BSP NotificaMe.

## Endpoints

### POST /webhook-notificame?channel_id={uuid}

Recebe eventos do BSP (mensagens recebidas + status updates).

**Parâmetros:**
- `channel_id` (query, required): UUID do canal no banco

**Headers:**
- `Content-Type: application/json`
- `x-hub-signature-256` (opcional): HMAC signature para validação

**Body:** Payload do WhatsApp Cloud API (Meta format)

**Resposta Sucesso (200):**
```json
{
  "success": true,
  "events_processed": 2,
  "messages_created": 1,
  "messages_updated": 1,
  "errors": []
}
```

**Resposta Erro (200 - para evitar reentrega):**
```json
{
  "success": false,
  "error": "Parse error",
  "events_processed": 0
}
```

**Resposta Erro (4xx):**
```json
{
  "error": "Channel not found"
}
```

---

### GET /webhook-notificame?channel_id={uuid}

Health check e verificação Meta (hub.challenge).

**Parâmetros:**
- `channel_id` (query, required): UUID do canal
- `hub.mode` (query, optional): "subscribe" para verificação Meta
- `hub.verify_token` (query, optional): Token de verificação
- `hub.challenge` (query, optional): Challenge para responder

**Resposta Health Check (200):**
```json
{
  "status": "ok",
  "channel_id": "uuid",
  "channel_name": "Meu WhatsApp",
  "channel_status": "connected",
  "provider": "notificame",
  "timestamp": "2025-01-09T..."
}
```

**Resposta Verificação Meta (200):**
```
hub.challenge value (plain text)
```

---

## Configuração no BSP

Configure o webhook no painel do NotificaMe com:

```
URL: https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=SEU_CHANNEL_ID

Método: POST
Eventos: messages, message_status
```

---

## Fluxo de Processamento

```
┌─────────────────────────────────────────────────────────────┐
│                    Webhook Request                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Validar channel_id e buscar channel no banco           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Validar webhook (HMAC se configurado)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Salvar payload bruto em mt_webhook_events               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Parse eventos com provider.parseWebhook()               │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────────┐                   ┌───────────────────┐
│  message.inbound  │                   │  message.status   │
└────────┬──────────┘                   └────────┬──────────┘
         │                                       │
         ▼                                       ▼
┌───────────────────┐                   ┌───────────────────┐
│ Upsert Contact    │                   │ Update Message    │
│ Upsert Convers.   │                   │ Status            │
│ Insert Message    │                   │                   │
│ (idempotent)      │                   │                   │
└───────────────────┘                   └───────────────────┘
         │                                       │
         └───────────────────┬───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Responder 200 (sempre, para robustez)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tabelas Afetadas

| Tabela | Operação | Quando |
|--------|----------|--------|
| `mt_webhook_events` | INSERT | Sempre (payload bruto) |
| `mt_contacts` | UPSERT | Mensagem inbound |
| `conversations` | UPSERT | Mensagem inbound |
| `mt_messages` | INSERT | Mensagem inbound (idempotente) |
| `mt_messages` | UPDATE | Status update (sent/delivered/read/failed) |

---

## Idempotência

- Mensagens inbound são identificadas por `provider_message_id`
- Se uma mensagem com o mesmo `provider_message_id` já existe, não é duplicada
- O webhook sempre responde 200, mesmo em caso de duplicata

---

## Checklist de Testes

### 1. Mensagem Inbound Nova
```bash
curl -X POST "https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=CHANNEL_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "id": "wamid.test123",
            "from": "5511999999999",
            "type": "text",
            "timestamp": "1704800000",
            "text": { "body": "Olá!" }
          }],
          "contacts": [{ "wa_id": "5511999999999" }],
          "metadata": { "display_phone_number": "5511888888888" }
        }
      }]
    }]
  }'
```

**Esperado:**
- Contact criado/atualizado em `mt_contacts`
- Conversation criada/atualizada em `conversations`
- Message criada em `mt_messages`
- Response: `{ "success": true, "messages_created": 1 }`

### 2. Mensagem Duplicada
Enviar o mesmo payload acima novamente.

**Esperado:**
- Nenhuma nova message criada
- Response: `{ "success": true, "messages_created": 0 }`

### 3. Status Update
```bash
curl -X POST "https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=CHANNEL_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "statuses": [{
            "id": "wamid.outbound123",
            "status": "delivered",
            "timestamp": "1704800100"
          }]
        }
      }]
    }]
  }'
```

**Esperado:**
- Message atualizada com `status: delivered` e `delivered_at`
- Response: `{ "success": true, "messages_updated": 1 }`

### 4. Status Órfão
Enviar status para message que não existe.

**Esperado:**
- Log de warning
- Response: `{ "success": true }` (não quebra)

### 5. Health Check
```bash
curl "https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=CHANNEL_ID"
```

**Esperado:**
- Response: `{ "status": "ok", "channel_name": "...", ... }`

### 6. Verificação Meta
```bash
curl "https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/webhook-notificame?channel_id=CHANNEL_ID&hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE123"
```

**Esperado:**
- Response: `CHALLENGE123` (plain text)

---

## Logs

Os logs são estruturados e incluem:
- `[Webhook] Channel: nome, Tenant: uuid, Provider: notificame`
- `[Webhook] Parsed X events`
- `[Webhook] Contact created/updated: uuid`
- `[Webhook] Conversation created/updated: uuid`
- `[Webhook] Message created: uuid, provider_id: wamid.xxx`
- `[Webhook] Duplicate message ignored: wamid.xxx`
- `[Webhook] Message status updated: uuid -> delivered`
- `[Webhook] Orphan status update for: wamid.xxx`

---

## Segurança

1. **Multi-tenant**: O `channel_id` determina o `tenant_id`
2. **HMAC**: Se `webhook_secret` estiver configurado no channel, valida assinatura
3. **Service Role**: Usa `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS
4. **Auditoria**: Todo payload é salvo em `mt_webhook_events`
