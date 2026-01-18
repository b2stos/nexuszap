/**
 * Provider Connector - Generic Interface
 * 
 * Abstração para integração com BSPs de WhatsApp.
 * Cada provider implementa esta interface.
 */

// ============================================
// CHANNEL CONFIG
// ============================================

export interface ChannelProviderConfig {
  base_url: string;
  api_key: string; // Token de autenticação da API
  api_key_header?: string; // default: "Authorization"
  api_key_prefix?: string; // default: "Bearer"
  webhook_secret?: string; // para HMAC validation
  phone_number_id?: string;
  
  // NotificaMe specific
  subscription_id?: string; // UUID do canal no NotificaMe (from)
  
  // Endpoint paths (override defaults)
  endpoints?: {
    send_message?: string;
    send_template?: string;
    upload_media?: string;
    get_media?: string;
  };
  
  // Custom headers
  custom_headers?: Record<string, string>;
  
  // Timeouts
  timeout_ms?: number;
}

export interface Channel {
  id: string;
  tenant_id: string;
  provider_id: string;
  name: string;
  phone_number?: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  provider_config: ChannelProviderConfig;
  provider_phone_id?: string;
}

// ============================================
// SEND REQUESTS
// ============================================

export interface SendTextRequest {
  channel: Channel;
  to: string; // phone number E.164
  text: string;
  reply_to_provider_message_id?: string;
}

export interface TemplateVariable {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  value: string;
  // For currency
  currency_code?: string;
  amount_1000?: number;
  // For date_time
  fallback_value?: string;
}

export interface TemplateMedia {
  type: 'image' | 'document' | 'video';
  url?: string;
  media_id?: string;
  filename?: string;
}

export interface SendTemplateRequest {
  channel: Channel;
  to: string;
  template_name: string;
  language: string;
  variables?: Record<string, TemplateVariable[]>; // keyed by component type: header, body, button
  media?: TemplateMedia;
}

export interface UploadMediaRequest {
  channel: Channel;
  file_url?: string;
  file_bytes?: Uint8Array;
  mime_type: string;
  filename?: string;
}

// ============================================
// SEND RESPONSES
// ============================================

export interface SendResponse {
  success: boolean;
  provider_message_id?: string;
  raw: unknown;
  error?: ProviderError;
}

export interface UploadMediaResponse {
  success: boolean;
  media_id?: string;
  raw: unknown;
  error?: ProviderError;
}

// ============================================
// WEBHOOK EVENTS (NORMALIZED)
// ============================================

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'document' 
  | 'audio' 
  | 'video' 
  | 'sticker' 
  | 'location' 
  | 'contact' 
  | 'template'
  | 'unknown';

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MediaInfo {
  media_id?: string;
  url?: string;
  mime_type?: string;
  filename?: string;
  sha256?: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactInfo {
  name: string;
  phones: string[];
}

export interface InboundMessageEvent {
  type: 'message.inbound';
  provider_message_id: string;
  from_phone: string;
  to_phone: string;
  message_type: MessageType;
  text?: string;
  media?: MediaInfo;
  location?: LocationInfo;
  contacts?: ContactInfo[];
  timestamp: Date;
  raw: unknown;
}

export interface StatusUpdateEvent {
  type: 'message.status';
  provider_message_id: string;
  status: DeliveryStatus;
  error?: {
    code: string;
    detail: string;
  };
  timestamp: Date;
  raw: unknown;
}

export type WebhookEvent = InboundMessageEvent | StatusUpdateEvent;

// ============================================
// ERRORS
// ============================================

export type ErrorCategory = 
  | 'auth'           // Token inválido, expirado
  | 'rate_limit'     // Limite de requisições
  | 'invalid_request'// Payload malformado
  | 'template_error' // Template não aprovado, variáveis erradas
  | 'recipient_error'// Número inválido, bloqueado
  | 'payment_error'  // Problema de pagamento/billing (ex: 131042)
  | 'temporary'      // Erro temporário do provider
  | 'unknown';

export interface ProviderError {
  category: ErrorCategory;
  code: string;
  detail: string;
  is_retryable: boolean;
  raw?: unknown;
  /** Se true, este erro deve bloquear todo o canal (ex: 131042) */
  blocks_channel?: boolean;
}

// ============================================
// PROVIDER INTERFACE
// ============================================

export interface WebhookValidationRequest {
  channel: Channel;
  headers: Record<string, string>;
  body: unknown;
  raw_body?: string; // para HMAC validation
}

export interface Provider {
  readonly name: string;
  readonly type: 'official_bsp' | 'unofficial';

  /**
   * Envia mensagem de texto (apenas dentro da janela 24h)
   */
  sendText(request: SendTextRequest): Promise<SendResponse>;

  /**
   * Envia template (campanhas e fora da janela 24h)
   */
  sendTemplate(request: SendTemplateRequest): Promise<SendResponse>;

  /**
   * Upload de mídia para o provider
   */
  uploadMedia(request: UploadMediaRequest): Promise<UploadMediaResponse>;

  /**
   * Valida autenticidade do webhook (HMAC, etc)
   * Lança erro se inválido
   */
  validateWebhook(request: WebhookValidationRequest): Promise<boolean>;

  /**
   * Parseia o payload do webhook e retorna eventos normalizados
   */
  parseWebhook(channel: Channel, body: unknown): WebhookEvent[];

  /**
   * Testa conexão com o provider
   */
  testConnection(channel: Channel): Promise<{ success: boolean; error?: ProviderError }>;
}

// ============================================
// DB MAPPING HELPERS (output types)
// ============================================

export interface MappedContact {
  phone: string;
  name?: string;
}

export interface MappedConversation {
  channel_id: string;
  contact_phone: string;
  last_inbound_at: Date;
  last_message_at: Date;
  last_message_preview?: string;
}

export interface MappedMessage {
  direction: 'inbound' | 'outbound';
  type: MessageType;
  content?: string;
  media_url?: string;
  media_mime_type?: string;
  media_filename?: string;
  provider_message_id: string;
  status: DeliveryStatus;
  created_at: Date;
}

export interface MappedStatusUpdate {
  provider_message_id: string;
  status: DeliveryStatus;
  error_code?: string;
  error_detail?: string;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  failed_at?: Date;
}
