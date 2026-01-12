# Provider Connector Layer

Camada de abstração para integração com BSPs de WhatsApp API Oficial.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  (Edge Functions: webhooks, campaigns, inbox)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Interface                            │
│  • sendText()     • parseWebhook()                              │
│  • sendTemplate() • validateWebhook()                           │
│  • uploadMedia()  • testConnection()                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   NotificaMe  │   │   Future BSP  │   │   Future BSP  │
│   (official)  │   │   Provider    │   │   Provider    │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Uso

### 1. Obter Provider

```typescript
import { getProvider, getProviderForChannel } from './_shared/providers/index.ts';

// Por nome
const provider = getProvider('notificame');

// Por channel
const provider = getProviderForChannel(channel, 'notificame');
```

### 2. Enviar Texto (dentro da janela 24h)

```typescript
import { getProvider } from './_shared/providers/index.ts';

const provider = getProvider('notificame');

const result = await provider.sendText({
  channel,
  to: '5511999999999',
  text: 'Olá! Como posso ajudar?',
  reply_to_provider_message_id: 'wamid.xxx', // opcional
});

if (result.success) {
  console.log('Message ID:', result.provider_message_id);
} else {
  console.error('Error:', result.error);
}
```

### 3. Enviar Template (campanhas ou fora da janela)

```typescript
const result = await provider.sendTemplate({
  channel,
  to: '5511999999999',
  template_name: 'welcome_message',
  language: 'pt_BR',
  variables: {
    body: [
      { type: 'text', value: 'João' },
      { type: 'text', value: 'Empresa XYZ' },
    ],
  },
  media: {
    type: 'image',
    url: 'https://example.com/image.jpg',
  },
});
```

### 4. Upload de Mídia

```typescript
const result = await provider.uploadMedia({
  channel,
  file_url: 'https://example.com/document.pdf',
  mime_type: 'application/pdf',
  filename: 'proposta.pdf',
});

if (result.success) {
  console.log('Media ID:', result.media_id);
}
```

### 5. Processar Webhook

```typescript
import { getProvider } from './_shared/providers/index.ts';
import { 
  mapInboundToContact,
  mapInboundToConversation,
  mapInboundToMessage,
  mapStatusToUpdate,
} from './_shared/providers/mappers.ts';

// No handler do webhook
const provider = getProvider('notificame');

// Validar autenticidade
await provider.validateWebhook({
  channel,
  headers: req.headers,
  body: payload,
  raw_body: rawBody,
});

// Parsear eventos
const events = provider.parseWebhook(channel, payload);

for (const event of events) {
  if (event.type === 'message.inbound') {
    // Mapear para estruturas do banco
    const contact = mapInboundToContact(event);
    const conversation = mapInboundToConversation(event, channel.id);
    const message = mapInboundToMessage(event);
    
    // Salvar no banco (implementar no próximo passo)
    // await saveInboundMessage(contact, conversation, message);
  } else if (event.type === 'message.status') {
    const update = mapStatusToUpdate(event);
    
    // Atualizar mensagem (implementar no próximo passo)
    // await updateMessageStatus(update);
  }
}
```

### 6. Verificar Janela 24h

```typescript
import { isWithin24hWindow, getTimeRemainingIn24hWindow } from './_shared/providers/mappers.ts';

// Verificar se pode enviar texto
if (isWithin24hWindow(conversation.last_inbound_at)) {
  // Pode enviar texto livre
  await provider.sendText({ ... });
} else {
  // Deve usar template
  await provider.sendTemplate({ ... });
}

// Obter tempo restante
const window = getTimeRemainingIn24hWindow(conversation.last_inbound_at);
console.log(window.remainingFormatted); // "5h 30m restantes"
```

## Configuração do Channel

O `provider_config` do channel deve conter:

```json
{
  "base_url": "https://api.notificame.com.br",
  "api_key": "seu-token-jwt-aqui",
  "subscription_id": "uuid-do-canal",
  "api_key_prefix": "Bearer",
  "webhook_secret": "opcional-para-hmac",
  "phone_number_id": "id-do-numero-no-provider",
  "endpoints": {
    "send_message": "/v1/messages",
    "send_template": "/v1/messages",
    "upload_media": "/v1/media"
  },
  "timeout_ms": 30000
}
```

## Eventos Normalizados

### Inbound Message

```typescript
{
  type: 'message.inbound',
  provider_message_id: 'wamid.xxx',
  from_phone: '5511999999999',
  to_phone: '5511888888888',
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact',
  text?: 'Conteúdo da mensagem',
  media?: {
    media_id: 'xxx',
    url: 'https://...',
    mime_type: 'image/jpeg',
    filename: 'foto.jpg',
  },
  location?: {
    latitude: -23.5,
    longitude: -46.6,
    name: 'Local',
    address: 'Endereço',
  },
  contacts?: [{ name: 'João', phones: ['5511...'] }],
  timestamp: Date,
  raw: { ... }, // Payload original
}
```

### Status Update

```typescript
{
  type: 'message.status',
  provider_message_id: 'wamid.xxx',
  status: 'sent' | 'delivered' | 'read' | 'failed',
  error?: {
    code: '131026',
    detail: 'Message failed...',
  },
  timestamp: Date,
  raw: { ... },
}
```

## Tratamento de Erros

```typescript
{
  category: 'auth' | 'rate_limit' | 'invalid_request' | 'template_error' | 'recipient_error' | 'temporary' | 'unknown',
  code: 'HTTP_401',
  detail: 'Invalid token',
  is_retryable: boolean,
  raw?: { ... },
}
```

### Categorias

| Categoria | Descrição | Retryable |
|-----------|-----------|-----------|
| `auth` | Token inválido/expirado | ❌ |
| `rate_limit` | Limite de requisições | ✅ |
| `invalid_request` | Payload malformado | ❌ |
| `template_error` | Template não aprovado | ❌ |
| `recipient_error` | Número inválido/bloqueado | ❌ |
| `temporary` | Erro temporário do provider | ✅ |
| `unknown` | Erro desconhecido | ❌ |

## Extensibilidade

Para adicionar um novo provider:

```typescript
import { Provider, registerProvider } from './_shared/providers/index.ts';

const myProvider: Provider = {
  name: 'my-bsp',
  type: 'official_bsp',
  
  async sendText(request) { ... },
  async sendTemplate(request) { ... },
  async uploadMedia(request) { ... },
  async validateWebhook(request) { ... },
  parseWebhook(channel, body) { ... },
  async testConnection(channel) { ... },
};

registerProvider('my-bsp', myProvider);
```
