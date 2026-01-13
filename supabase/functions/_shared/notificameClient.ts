/**
 * NotificaMe API Client - Single Source of Truth
 * 
 * Adapter único para todas as chamadas ao NotificaMe.
 * 
 * REGRA ÚNICA DE AUTENTICAÇÃO:
 * - 1 token: NOTIFICAME_TOKEN (variável de ambiente)
 * - 1 header: X-API-Token
 * - 1 baseUrl: https://api.notificame.com.br/v1
 */

// ===========================================
// CONFIGURAÇÃO CENTRALIZADA
// ===========================================

const CONFIG = {
  BASE_URL: 'https://api.notificame.com.br/v1',
  AUTH_HEADER: 'X-API-Token',
  TIMEOUT_MS: 30000,
} as const;

// ===========================================
// TIPOS
// ===========================================

export interface NotificaMeResponse<T = unknown> {
  success: boolean;
  status: number;
  data: T;
  error?: {
    code: string;
    message: string;
    isRetryable: boolean;
  };
}

export interface SendTextParams {
  subscriptionId: string;
  to: string;
  text: string;
  replyToMessageId?: string;
}

export interface SendTemplateParams {
  subscriptionId: string;
  to: string;
  templateName: string;
  language: string;
  variables?: Record<string, unknown>;
}

export interface WebhookMessage {
  type: 'inbound' | 'status';
  messageId: string;
  from?: string;
  to?: string;
  content?: string;
  contentType?: string;
  status?: string;
  timestamp: Date;
  visitorName?: string;
  mediaUrl?: string;
  raw: unknown;
}

// ===========================================
// EXTRAÇÃO DE TOKEN
// ===========================================

/**
 * Extrai o token JWT de várias formas possíveis de input.
 * Suporta: token puro, comando curl, JSON, header
 */
function extractToken(raw: string | undefined | null): string {
  if (!raw) return '';
  
  // Keep only ASCII printable characters
  let clean = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 32 && code <= 126) clean += raw[i];
  }
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Pattern A: Extract from curl command or header format
  const headerMatch = clean.match(/(?:X-API-Token|Authorization)[\s:]+['"]?(?:Bearer\s+)?([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['"]?/i);
  if (headerMatch?.[1]) {
    console.log('[NotificaMe] Token extracted from header/curl format');
    return headerMatch[1];
  }
  
  // Pattern B: Extract from JSON
  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(clean);
      const extracted = parsed.token || parsed.api_token || parsed['X-API-Token'] || parsed.access_token;
      if (extracted) {
        console.log('[NotificaMe] Token extracted from JSON');
        return String(extracted).trim();
      }
    } catch {
      // Not valid JSON
    }
  }
  
  // Pattern C: Extract JWT pattern
  const jwtMatch = clean.match(/\b([A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})\b/);
  if (jwtMatch?.[1]) {
    console.log('[NotificaMe] Token extracted from JWT pattern');
    return jwtMatch[1];
  }
  
  // Pattern D: Strip "Bearer " prefix
  if (clean.toLowerCase().startsWith('bearer ')) {
    return clean.substring(7).trim();
  }
  
  return clean;
}

// ===========================================
// CLIENTE PRINCIPAL
// ===========================================

class NotificaMeClient {
  private token: string = '';
  private initialized: boolean = false;

  /**
   * Inicializa o cliente com o token da ENV
   */
  private init(): void {
    if (this.initialized) return;
    
    const rawToken = Deno.env.get('NOTIFICAME_TOKEN') || Deno.env.get('NOTIFICAME_X_API_TOKEN') || '';
    this.token = extractToken(rawToken);
    this.initialized = true;
    
    if (this.token) {
      const masked = this.token.length > 10 
        ? `${this.token.substring(0, 6)}...${this.token.substring(this.token.length - 4)}`
        : '[SHORT]';
      console.log(`[NotificaMe] Client initialized with token: ${masked} (${this.token.length} chars)`);
    } else {
      console.error('[NotificaMe] No token found in NOTIFICAME_TOKEN or NOTIFICAME_X_API_TOKEN');
    }
  }

  /**
   * Verifica se o cliente tem um token válido
   */
  hasToken(): boolean {
    this.init();
    return !!this.token;
  }

  /**
   * Faz uma requisição genérica ao NotificaMe
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<NotificaMeResponse<T>> {
    this.init();

    if (!this.token) {
      return {
        success: false,
        status: 0,
        data: null as T,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token NotificaMe não configurado. Configure NOTIFICAME_TOKEN no servidor.',
          isRetryable: false,
        },
      };
    }

    const url = `${CONFIG.BASE_URL}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

    // Headers padrão - ÚNICO formato
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      [CONFIG.AUTH_HEADER]: this.token,
    };

    console.log(`[NotificaMe] >>> ${method} ${url}`);
    if (body) {
      console.log(`[NotificaMe] >>> Body: ${JSON.stringify(body).substring(0, 300)}`);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let data: T;

      try {
        data = JSON.parse(responseText) as T;
      } catch {
        // Check for HTML response (wrong URL or auth page)
        if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
          console.error('[NotificaMe] Received HTML instead of JSON');
          return {
            success: false,
            status: response.status,
            data: null as T,
            error: {
              code: 'INVALID_RESPONSE',
              message: 'API retornou HTML ao invés de JSON. Verifique a URL.',
              isRetryable: false,
            },
          };
        }
        data = responseText as unknown as T;
      }

      // Mask tokens in logs
      const sanitizedResponse = JSON.stringify(data)
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT]')
        .substring(0, 500);
      console.log(`[NotificaMe] <<< ${response.status}: ${sanitizedResponse}`);

      if (!response.ok) {
        const errorData = data as Record<string, unknown>;
        return {
          success: false,
          status: response.status,
          data,
          error: this.parseError(response.status, errorData),
        };
      }

      return { success: true, status: response.status, data };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          status: 0,
          data: null as T,
          error: {
            code: 'TIMEOUT',
            message: `Timeout após ${CONFIG.TIMEOUT_MS}ms`,
            isRetryable: true,
          },
        };
      }

      console.error('[NotificaMe] Request error:', error);
      return {
        success: false,
        status: 0,
        data: null as T,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Erro de rede',
          isRetryable: true,
        },
      };
    }
  }

  /**
   * Envia mensagem de texto
   */
  async sendText(params: SendTextParams): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
    const { subscriptionId, to, text, replyToMessageId } = params;

    if (!subscriptionId) {
      return {
        success: false,
        status: 0,
        data: {},
        error: {
          code: 'MISSING_SUBSCRIPTION_ID',
          message: 'Subscription ID não configurado no canal.',
          isRetryable: false,
        },
      };
    }

    const phone = this.normalizePhone(to);
    const payload: Record<string, unknown> = {
      from: subscriptionId,
      to: phone,
      contents: [{ type: 'text', text }],
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    console.log(`[NotificaMe] Sending text to ${phone} via subscription ${subscriptionId.substring(0, 8)}...`);

    return this.request<{ id?: string; messageId?: string }>('POST', '/channels/whatsapp/messages', payload);
  }

  /**
   * Envia template
   */
  async sendTemplate(params: SendTemplateParams): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
    const { subscriptionId, to, templateName, language, variables } = params;

    if (!subscriptionId) {
      return {
        success: false,
        status: 0,
        data: {},
        error: {
          code: 'MISSING_SUBSCRIPTION_ID',
          message: 'Subscription ID não configurado no canal.',
          isRetryable: false,
        },
      };
    }

    const phone = this.normalizePhone(to);
    const payload: Record<string, unknown> = {
      from: subscriptionId,
      to: phone,
      contents: [{
        type: 'template',
        templateName,
        language: { code: language },
        ...(variables && { components: this.buildTemplateComponents(variables) }),
      }],
    };

    console.log(`[NotificaMe] Sending template "${templateName}" to ${phone}`);

    return this.request<{ id?: string; messageId?: string }>('POST', '/channels/whatsapp/messages', payload);
  }

  /**
   * Testa a conexão com o NotificaMe
   */
  async testConnection(subscriptionId?: string): Promise<NotificaMeResponse<unknown>> {
    if (!this.hasToken()) {
      return {
        success: false,
        status: 0,
        data: null,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token não configurado no servidor.',
          isRetryable: false,
        },
      };
    }

    // Send empty payload to test auth - expect 400/422 (auth OK, payload invalid)
    const result = await this.request<{ code?: string; message?: string }>('POST', '/channels/whatsapp/messages', {});

    // 401/403 = token inválido
    if (result.status === 401 || result.status === 403) {
      return {
        success: false,
        status: result.status,
        data: result.data,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token rejeitado pelo NotificaMe.',
          isRetryable: false,
        },
      };
    }

    // 400/422 = token OK (payload foi rejeitado, mas auth passou)
    if (result.status === 400 || result.status === 422) {
      return {
        success: true,
        status: result.status,
        data: { message: 'Token autenticado com sucesso!' },
      };
    }

    return result;
  }

  /**
   * Parseia eventos de webhook do NotificaMe
   */
  parseWebhook(payload: Record<string, unknown>, channelPhone?: string): WebhookMessage[] {
    const events: WebhookMessage[] = [];

    const msgType = payload.type as string;
    const direction = payload.direction as string;
    const message = payload.message as Record<string, unknown> | undefined;

    if (!message) return events;

    // Mensagem inbound
    if (msgType === 'MESSAGE' && direction === 'IN') {
      const fromPhone = String(message.from || '');
      const providerMessageId = String(payload.providerMessageId || payload.id || '');
      const contents = message.contents as Array<Record<string, unknown>> | undefined;
      const visitor = message.visitor as Record<string, unknown> | undefined;

      const firstContent = contents?.[0];
      const contentType = String(firstContent?.type || 'text');
      const textContent = String(firstContent?.text || '');

      events.push({
        type: 'inbound',
        messageId: providerMessageId,
        from: fromPhone,
        to: channelPhone,
        content: textContent,
        contentType,
        timestamp: new Date(),
        visitorName: visitor?.name ? String(visitor.name) : undefined,
        mediaUrl: String(firstContent?.url || firstContent?.fileUrl || '') || undefined,
        raw: payload,
      });
    }

    // Status update
    if (msgType === 'STATUS' || msgType === 'MESSAGE_STATUS') {
      const status = String(payload.status || message.status || '').toLowerCase();
      const providerMessageId = String(payload.providerMessageId || payload.messageId || payload.id || '');

      if (status && providerMessageId) {
        events.push({
          type: 'status',
          messageId: providerMessageId,
          status,
          timestamp: new Date(),
          raw: payload,
        });
      }
    }

    return events;
  }

  // ===========================================
  // HELPERS PRIVADOS
  // ===========================================

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  }

  private parseError(status: number, data: Record<string, unknown>): { code: string; message: string; isRetryable: boolean } {
    const code = String(data.code || data.error || `HTTP_${status}`);
    const message = String(data.message || data.detail || data.error || 'Erro desconhecido');

    const isRetryable = status >= 500 || status === 429;

    return { code, message, isRetryable };
  }

  private buildTemplateComponents(variables: Record<string, unknown>): Array<Record<string, unknown>> {
    const components: Array<Record<string, unknown>> = [];

    for (const [type, values] of Object.entries(variables)) {
      if (Array.isArray(values)) {
        components.push({
          type,
          parameters: values.map(v => ({ type: 'text', text: String(v) })),
        });
      }
    }

    return components;
  }
}

// Singleton export
export const notificame = new NotificaMeClient();
