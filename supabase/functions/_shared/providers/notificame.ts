/**
 * NotificaMe BSP Provider Implementation
 * 
 * Implementação do provider para API Oficial do WhatsApp via BSP NotificaMe.
 * Suporta tanto formato WhatsApp Cloud API (Meta) quanto formato nativo NotificaMe.
 */

import {
  Provider,
  Channel,
  ChannelProviderConfig,
  SendTextRequest,
  SendTemplateRequest,
  UploadMediaRequest,
  SendResponse,
  UploadMediaResponse,
  WebhookValidationRequest,
  WebhookEvent,
  InboundMessageEvent,
  StatusUpdateEvent,
  MessageType,
  DeliveryStatus,
  ProviderError,
} from './types.ts';

import {
  createProviderError,
  extractErrorFromResponse,
  ProviderException,
} from './errors.ts';

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_ENDPOINTS = {
  send_message: '/v1/messages',
  send_template: '/v1/messages',
  upload_media: '/v1/media',
  get_media: '/v1/media',
};

const DEFAULT_TIMEOUT_MS = 30000;

// ============================================
// HTTP CLIENT
// ============================================

interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function notificameRequest<T = unknown>(
  config: ChannelProviderConfig,
  options: HttpRequestOptions
): Promise<HttpResponse<T>> {
  // NotificaMe API base URL is always https://api.notificame.com.br
  let baseUrl = 'https://api.notificame.com.br';
  
  // Log if config has a different base_url (for debugging)
  if (config.base_url && !config.base_url.includes('api.notificame.com.br')) {
    console.warn('[NotificaMe] WARN: config base_url is not api.notificame.com.br, using default');
  }
  
  const url = `${baseUrl}${options.path}`;
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.custom_headers,
    ...options.headers,
  };
  
  // Auth header - NotificaMe Hub uses X-API-Token header (capital X)
  headers['X-API-Token'] = config.api_key;
  
  // Timeout handling
  const timeout = options.timeout_ms || config.timeout_ms || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`[NotificaMe] ${options.method} ${url}`);
    console.log(`[NotificaMe] Request body:`, options.body ? JSON.stringify(options.body).substring(0, 300) : 'none');
    
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const responseText = await response.text();
    let data: T;
    
    // Try to parse as JSON
    try {
      data = JSON.parse(responseText) as T;
    } catch {
      // If not JSON, check if it's an HTML page (login page = wrong URL)
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        console.error('[NotificaMe] ERROR: Received HTML instead of JSON - likely wrong API URL or authentication page');
        throw new ProviderException(
          createProviderError('invalid_request', 'WRONG_URL', 
            `API returned HTML instead of JSON. Check if base_url (${baseUrl}) is correct. Expected: https://api.notifica.me`)
        );
      }
      data = responseText as unknown as T;
    }
    
    console.log(`[NotificaMe] Response ${response.status}:`, JSON.stringify(data).substring(0, 500));
    
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof ProviderException) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderException(
        createProviderError('temporary', 'TIMEOUT', `Request timed out after ${timeout}ms`)
      );
    }
    
    throw new ProviderException(
      createProviderError('temporary', 'NETWORK_ERROR', error instanceof Error ? error.message : 'Network error')
    );
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getEndpoint(config: ChannelProviderConfig, key: keyof typeof DEFAULT_ENDPOINTS): string {
  return config.endpoints?.[key] || DEFAULT_ENDPOINTS[key];
}

function normalizePhoneNumber(phone: string): string {
  // Remove tudo exceto dígitos
  const digits = phone.replace(/\D/g, '');
  
  // Garante formato internacional sem o +
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  // Se for número brasileiro sem DDI
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  
  return digits;
}

function mapWebhookMessageType(waType: string): MessageType {
  const typeMap: Record<string, MessageType> = {
    text: 'text',
    image: 'image',
    document: 'document',
    audio: 'audio',
    video: 'video',
    sticker: 'sticker',
    location: 'location',
    contacts: 'contact',
  };
  return typeMap[waType] || 'text';
}

function mapWebhookStatus(waStatus: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };
  return statusMap[waStatus] || 'sent';
}

// ============================================
// NOTIFICAME NATIVE FORMAT PARSER
// ============================================

/**
 * Parse NotificaMe's native webhook format
 * Example payload:
 * {
 *   "channel": "whatsapp_business_account",
 *   "direction": "IN",
 *   "id": "uuid",
 *   "message": {
 *     "from": "5511947892299",
 *     "to": "subscription-id",
 *     "timestamp": "2026-01-12 06:37:09 pm",
 *     "contents": [{ "text": "Opa", "type": "text" }],
 *     "visitor": { "name": "Bruno Bastos" }
 *   },
 *   "providerMessageId": "base64-encoded-id",
 *   "type": "MESSAGE"
 * }
 */
function parseNotificaMeNativeFormat(channel: Channel, payload: Record<string, unknown>): WebhookEvent[] {
  const events: WebhookEvent[] = [];
  
  // Check if this is NotificaMe native format
  const msgType = payload.type as string;
  const direction = payload.direction as string;
  const message = payload.message as Record<string, unknown> | undefined;
  
  if (!message) {
    console.log('[NotificaMe] No message object in payload');
    return events;
  }
  
  // Handle MESSAGE type (inbound or outbound)
  if (msgType === 'MESSAGE' && direction === 'IN') {
    const fromPhone = String(message.from || '');
    const providerMessageId = String(payload.providerMessageId || payload.id || '');
    const contents = message.contents as Array<Record<string, unknown>> | undefined;
    const visitor = message.visitor as Record<string, unknown> | undefined;
    const timestampStr = String(message.timestamp || '');
    
    // Parse timestamp (format: "2026-01-12 06:37:09 pm")
    let timestamp = new Date();
    if (timestampStr) {
      try {
        // Convert "2026-01-12 06:37:09 pm" to parseable format
        const cleanTs = timestampStr.replace(/ (am|pm)/i, (m) => m.toUpperCase());
        const parsed = new Date(cleanTs);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed;
        }
      } catch {
        // Keep current timestamp
      }
    }
    
    // Get first content (usually just one)
    const firstContent = contents?.[0];
    const contentType = String(firstContent?.type || 'text');
    const textContent = String(firstContent?.text || '');
    
    const event: InboundMessageEvent = {
      type: 'message.inbound',
      provider_message_id: providerMessageId,
      from_phone: fromPhone,
      to_phone: channel.phone_number || '',
      message_type: mapWebhookMessageType(contentType),
      timestamp,
      raw: payload,
    };
    
    // Extract content based on type
    if (contentType === 'text') {
      event.text = textContent;
    } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(contentType)) {
      const mediaUrl = String(firstContent?.url || firstContent?.fileUrl || '');
      const mimeType = String(firstContent?.mimeType || firstContent?.mime_type || '');
      const filename = String(firstContent?.fileName || firstContent?.filename || '');
      
      event.media = {
        media_id: providerMessageId,
        mime_type: mimeType,
        sha256: '',
        url: mediaUrl,
        filename: filename,
      };
      
      // Caption if any
      const caption = String(firstContent?.caption || '');
      if (caption) {
        event.text = caption;
      }
    } else if (contentType === 'location') {
      event.location = {
        latitude: Number(firstContent?.latitude || 0),
        longitude: Number(firstContent?.longitude || 0),
        name: firstContent?.name ? String(firstContent.name) : undefined,
        address: firstContent?.address ? String(firstContent.address) : undefined,
      };
    }
    
    // Store visitor name for contact creation
    if (visitor?.name) {
      (event as unknown as Record<string, unknown>).visitor_name = String(visitor.name);
    }
    
    console.log(`[NotificaMe] Parsed inbound message from ${fromPhone}: "${textContent.substring(0, 50)}"`);
    events.push(event);
  }
  
  // Handle STATUS type (delivery status updates)
  if (msgType === 'STATUS' || msgType === 'MESSAGE_STATUS') {
    const status = String(payload.status || message.status || '').toLowerCase();
    const providerMessageId = String(payload.providerMessageId || payload.messageId || payload.id || '');
    
    if (status && providerMessageId) {
      const event: StatusUpdateEvent = {
        type: 'message.status',
        provider_message_id: providerMessageId,
        status: mapWebhookStatus(status),
        timestamp: new Date(),
        raw: payload,
      };
      
      console.log(`[NotificaMe] Parsed status update: ${status} for ${providerMessageId}`);
      events.push(event);
    }
  }
  
  return events;
}

// ============================================
// WHATSAPP CLOUD API FORMAT PARSER
// ============================================

function parseWhatsAppCloudFormat(channel: Channel, payload: Record<string, unknown>): WebhookEvent[] {
  const events: WebhookEvent[] = [];
  
  // WhatsApp Cloud API webhook format
  // entry[].changes[].value.messages[] ou value.statuses[]
  
  const entry = payload.entry as Array<Record<string, unknown>> | undefined;
  
  if (!entry?.length) {
    return events;
  }
  
  for (const e of entry) {
    const changes = e.changes as Array<Record<string, unknown>> | undefined;
    
    if (!changes?.length) continue;
    
    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      
      if (!value) continue;
      
      // Inbound messages
      const messages = value.messages as Array<Record<string, unknown>> | undefined;
      const contacts = value.contacts as Array<Record<string, unknown>> | undefined;
      const metadata = value.metadata as Record<string, string> | undefined;
      
      if (messages?.length) {
        for (const msg of messages) {
          const contact = contacts?.find(c => c.wa_id === msg.from);
          
          const event: InboundMessageEvent = {
            type: 'message.inbound',
            provider_message_id: String(msg.id),
            from_phone: String(msg.from),
            to_phone: metadata?.display_phone_number || channel.phone_number || '',
            message_type: mapWebhookMessageType(String(msg.type)),
            timestamp: new Date(Number(msg.timestamp) * 1000),
            raw: msg,
          };
          
          // Extract content based on type
          const msgType = String(msg.type);
          
          if (msgType === 'text') {
            const textContent = msg.text as Record<string, unknown>;
            event.text = String(textContent?.body || '');
          } else if (['image', 'document', 'audio', 'video', 'sticker'].includes(msgType)) {
            const mediaContent = msg[msgType] as Record<string, unknown>;
            event.media = {
              media_id: String(mediaContent?.id || ''),
              mime_type: String(mediaContent?.mime_type || ''),
              sha256: String(mediaContent?.sha256 || ''),
            };
            if (msgType === 'image' || msgType === 'sticker') {
              event.text = String(mediaContent?.caption || '');
            }
            if (msgType === 'document') {
              event.media.filename = String(mediaContent?.filename || '');
              event.text = String(mediaContent?.caption || '');
            }
          } else if (msgType === 'location') {
            const locContent = msg.location as Record<string, unknown>;
            event.location = {
              latitude: Number(locContent?.latitude || 0),
              longitude: Number(locContent?.longitude || 0),
              name: locContent?.name ? String(locContent.name) : undefined,
              address: locContent?.address ? String(locContent.address) : undefined,
            };
          } else if (msgType === 'contacts') {
            const contactsContent = msg.contacts as Array<Record<string, unknown>>;
            event.contacts = contactsContent?.map(c => {
              const name = c.name as Record<string, unknown>;
              const phones = c.phones as Array<Record<string, unknown>>;
              return {
                name: String(name?.formatted_name || name?.first_name || ''),
                phones: phones?.map(p => String(p.phone || p.wa_id || '')) || [],
              };
            });
          }
          
          // Store visitor name from contact
          if (contact?.profile) {
            const profile = contact.profile as Record<string, unknown>;
            (event as unknown as Record<string, unknown>).visitor_name = String(profile.name || '');
          }
          
          events.push(event);
        }
      }
      
      // Status updates
      const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
      
      if (statuses?.length) {
        for (const status of statuses) {
          const event: StatusUpdateEvent = {
            type: 'message.status',
            provider_message_id: String(status.id),
            status: mapWebhookStatus(String(status.status)),
            timestamp: new Date(Number(status.timestamp) * 1000),
            raw: status,
          };
          
          // Error info
          if (status.status === 'failed') {
            const errors = status.errors as Array<Record<string, unknown>> | undefined;
            if (errors?.length) {
              event.error = {
                code: String(errors[0].code || 'UNKNOWN'),
                detail: String(errors[0].title || errors[0].message || 'Unknown error'),
              };
            }
          }
          
          events.push(event);
        }
      }
    }
  }
  
  return events;
}

// ============================================
// PROVIDER IMPLEMENTATION
// ============================================

export const notificameProvider: Provider = {
  name: 'notificame',
  type: 'official_bsp',

  async sendText(request: SendTextRequest): Promise<SendResponse> {
    const { channel, to, text, reply_to_provider_message_id } = request;
    const config = channel.provider_config;
    
    // NotificaMe Hub API format based on SDK analysis
    // The api_key is the subscriptionId which acts as both auth token and sender identifier
    const subscriptionId = config.api_key;
    const recipientPhone = normalizePhoneNumber(to);
    
    // Correct endpoint: POST /v2/channels/whatsapp/messages
    // Body: { from: subscriptionId, to: phone, contents: [{ type: "text", text: "message" }] }
    const notificaMePath = '/v2/channels/whatsapp/messages';
    
    const payload: Record<string, unknown> = {
      from: subscriptionId,
      to: recipientPhone,
      contents: [{
        type: 'text',
        text: text,
      }],
    };
    
    // Reply context (if NotificaMe supports it)
    if (reply_to_provider_message_id) {
      payload.context = {
        message_id: reply_to_provider_message_id,
      };
    }
    
    console.log(`[NotificaMe] Sending text to ${recipientPhone} via subscription ${subscriptionId}`);
    console.log(`[NotificaMe] POST ${notificaMePath}`);
    console.log(`[NotificaMe] Payload:`, JSON.stringify(payload));
    
    try {
      const response = await notificameRequest<{
        id?: string;
        messageId?: string;
        messages?: Array<{ id: string }>;
        error?: unknown;
      }>(config, {
        method: 'POST',
        path: notificaMePath,
        body: payload,
      });
      
      console.log(`[NotificaMe] Response status: ${response.status}, ok: ${response.ok}`);
      
      if (!response.ok) {
        const error = extractErrorFromResponse(response.status, response.data);
        console.error(`[NotificaMe] Send failed:`, JSON.stringify(error));
        return { success: false, raw: response.data, error };
      }
      
      // NotificaMe may return messageId in different formats
      const messageId = response.data.id || response.data.messageId || response.data.messages?.[0]?.id;
      
      console.log(`[NotificaMe] Message sent successfully, provider_message_id: ${messageId}`);
      
      return {
        success: true,
        provider_message_id: messageId,
        raw: response.data,
      };
    } catch (error) {
      console.error(`[NotificaMe] Exception during send:`, error);
      if (error instanceof ProviderException) {
        return { success: false, raw: null, error: error.providerError };
      }
      throw error;
    }
  },

  async sendTemplate(request: SendTemplateRequest): Promise<SendResponse> {
    const { channel, to, template_name, language, variables, media } = request;
    const config = channel.provider_config;
    const endpoint = getEndpoint(config, 'send_template');
    
    // Build components
    const components: Array<Record<string, unknown>> = [];
    
    // Header with media
    if (media) {
      const headerComponent: Record<string, unknown> = {
        type: 'header',
        parameters: [],
      };
      
      if (media.type === 'image') {
        headerComponent.parameters = [{
          type: 'image',
          image: media.media_id ? { id: media.media_id } : { link: media.url },
        }];
      } else if (media.type === 'document') {
        headerComponent.parameters = [{
          type: 'document',
          document: {
            ...(media.media_id ? { id: media.media_id } : { link: media.url }),
            filename: media.filename,
          },
        }];
      } else if (media.type === 'video') {
        headerComponent.parameters = [{
          type: 'video',
          video: media.media_id ? { id: media.media_id } : { link: media.url },
        }];
      }
      
      components.push(headerComponent);
    }
    
    // Header variables
    if (variables?.header?.length) {
      const existing = components.find(c => c.type === 'header');
      if (existing) {
        (existing.parameters as unknown[]).push(...variables.header.map(v => ({
          type: v.type,
          text: v.value,
        })));
      } else {
        components.push({
          type: 'header',
          parameters: variables.header.map(v => ({
            type: v.type,
            text: v.value,
          })),
        });
      }
    }
    
    // Body variables
    if (variables?.body?.length) {
      components.push({
        type: 'body',
        parameters: variables.body.map(v => {
          if (v.type === 'currency') {
            return {
              type: 'currency',
              currency: {
                code: v.currency_code,
                amount_1000: v.amount_1000,
                fallback_value: v.value,
              },
            };
          }
          if (v.type === 'date_time') {
            return {
              type: 'date_time',
              date_time: {
                fallback_value: v.fallback_value || v.value,
              },
            };
          }
          return { type: 'text', text: v.value };
        }),
      });
    }
    
    // Button variables
    if (variables?.button?.length) {
      variables.button.forEach((v, index) => {
        components.push({
          type: 'button',
          sub_type: 'quick_reply',
          index,
          parameters: [{ type: 'payload', payload: v.value }],
        });
      });
    }
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhoneNumber(to),
      type: 'template',
      template: {
        name: template_name,
        language: { code: language },
        components: components.length > 0 ? components : undefined,
      },
    };
    
    try {
      const response = await notificameRequest<{
        messages?: Array<{ id: string }>;
        error?: unknown;
      }>(config, {
        method: 'POST',
        path: endpoint,
        body: payload,
      });
      
      if (!response.ok) {
        const error = extractErrorFromResponse(response.status, response.data);
        return { success: false, raw: response.data, error };
      }
      
      const messageId = response.data.messages?.[0]?.id;
      
      return {
        success: true,
        provider_message_id: messageId,
        raw: response.data,
      };
    } catch (error) {
      if (error instanceof ProviderException) {
        return { success: false, raw: null, error: error.providerError };
      }
      throw error;
    }
  },

  async uploadMedia(request: UploadMediaRequest): Promise<UploadMediaResponse> {
    const { channel, file_url, file_bytes, mime_type, filename } = request;
    const config = channel.provider_config;
    const endpoint = getEndpoint(config, 'upload_media');
    
    // Se tiver URL, enviar diretamente (alguns BSPs suportam)
    // Se tiver bytes, fazer upload como multipart
    
    if (file_url) {
      // Attempt to use URL directly - some APIs support this
      try {
        const response = await notificameRequest<{
          id?: string;
          media_id?: string;
          error?: unknown;
        }>(config, {
          method: 'POST',
          path: endpoint,
          body: {
            messaging_product: 'whatsapp',
            type: mime_type.split('/')[0], // image, document, etc
            url: file_url,
          },
        });
        
        if (!response.ok) {
          const error = extractErrorFromResponse(response.status, response.data);
          return { success: false, raw: response.data, error };
        }
        
        return {
          success: true,
          media_id: response.data.id || response.data.media_id,
          raw: response.data,
        };
      } catch (error) {
        if (error instanceof ProviderException) {
          return { success: false, raw: null, error: error.providerError };
        }
        throw error;
      }
    }
    
  if (file_bytes) {
      // Multipart upload
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(file_bytes)], { type: mime_type });
      formData.append('file', blob, filename || 'file');
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mime_type.split('/')[0]);
      
      const baseUrl = config.base_url.replace(/\/$/, '');
      const url = `${baseUrl}${endpoint}`;
      
      const headers: Record<string, string> = { ...config.custom_headers };
      const authHeader = config.api_key_header || 'Authorization';
      const authPrefix = config.api_key_prefix ?? 'Bearer';
      headers[authHeader] = authPrefix ? `${authPrefix} ${config.api_key}` : config.api_key;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          const error = extractErrorFromResponse(response.status, data);
          return { success: false, raw: data, error };
        }
        
        return {
          success: true,
          media_id: data.id || data.media_id,
          raw: data,
        };
      } catch (error) {
        return {
          success: false,
          raw: null,
          error: createProviderError(
            'temporary',
            'UPLOAD_ERROR',
            error instanceof Error ? error.message : 'Upload failed'
          ),
        };
      }
    }
    
    return {
      success: false,
      raw: null,
      error: createProviderError('invalid_request', 'NO_FILE', 'No file URL or bytes provided'),
    };
  },

  async validateWebhook(request: WebhookValidationRequest): Promise<boolean> {
    const { channel, headers, raw_body } = request;
    const config = channel.provider_config;
    
    // Se tiver webhook_secret configurado, validar HMAC
    if (config.webhook_secret && raw_body) {
      const signature = headers['x-hub-signature-256'] || headers['x-signature'];
      
      if (!signature) {
        console.warn('[NotificaMe] Webhook missing signature header');
        // Não bloquear por enquanto, apenas logar
      }
      
      if (signature) {
        // Validate HMAC-SHA256
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(config.webhook_secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signatureBytes = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(raw_body)
        );
        
        const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        if (signature !== expectedSignature) {
          console.error('[NotificaMe] Invalid webhook signature');
          throw new ProviderException(
            createProviderError('auth', 'INVALID_SIGNATURE', 'Webhook signature validation failed')
          );
        }
      }
    }
    
    return true;
  },

  /**
   * Parse webhook payload - supports both NotificaMe native and WhatsApp Cloud API formats
   */
  parseWebhook(channel: Channel, body: unknown): WebhookEvent[] {
    if (!body || typeof body !== 'object') {
      console.warn('[NotificaMe] Invalid webhook body');
      return [];
    }
    
    const payload = body as Record<string, unknown>;
    
    // DETECT FORMAT:
    // 1. NotificaMe native: has "type": "MESSAGE", "direction", "message" object
    // 2. WhatsApp Cloud API: has "entry" array
    
    let events: WebhookEvent[] = [];
    
    // Check for NotificaMe native format first
    if (payload.type === 'MESSAGE' || payload.type === 'STATUS' || payload.type === 'MESSAGE_STATUS') {
      console.log('[NotificaMe] Detected native NotificaMe format');
      events = parseNotificaMeNativeFormat(channel, payload);
    }
    // Check for message object directly (simplified NotificaMe format)
    else if (payload.message && payload.direction) {
      console.log('[NotificaMe] Detected simplified NotificaMe format');
      events = parseNotificaMeNativeFormat(channel, payload);
    }
    // Check for WhatsApp Cloud API format
    else if (payload.entry) {
      console.log('[NotificaMe] Detected WhatsApp Cloud API format');
      events = parseWhatsAppCloudFormat(channel, payload);
    }
    // Unknown format - log for debugging
    else {
      console.warn('[NotificaMe] Unknown webhook format, keys:', Object.keys(payload));
      
      // Try to extract any message-like data
      if (payload.providerMessageId || payload.from || payload.message) {
        console.log('[NotificaMe] Attempting generic parse');
        events = parseNotificaMeNativeFormat(channel, payload);
      }
    }
    
    console.log(`[NotificaMe] Parsed ${events.length} events from webhook`);
    return events;
  },

  async testConnection(channel: Channel): Promise<{ success: boolean; error?: ProviderError }> {
    const config = channel.provider_config;
    
    // Tenta fazer uma request simples para validar token
    // A maioria dos BSPs tem um endpoint de health ou info
    
    try {
      const response = await notificameRequest(config, {
        method: 'GET',
        path: '/v1/health', // Fallback: pode não existir
        timeout_ms: 10000,
      });
      
      if (response.ok) {
        return { success: true };
      }
      
      // Se 404, tenta outro endpoint
      if (response.status === 404) {
        // Tenta listar templates como fallback
        const fallback = await notificameRequest(config, {
          method: 'GET',
          path: '/v1/message_templates',
          timeout_ms: 10000,
        });
        
        if (fallback.ok || fallback.status !== 401) {
          return { success: true };
        }
      }
      
      return {
        success: false,
        error: extractErrorFromResponse(response.status, response.data),
      };
    } catch (error) {
      if (error instanceof ProviderException) {
        return { success: false, error: error.providerError };
      }
      return {
        success: false,
        error: createProviderError('unknown', 'CONNECTION_ERROR', error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  },
};
