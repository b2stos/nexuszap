/**
 * NotificaMe API Client - Single Source of Truth
 * 
 * Adapter único para todas as chamadas ao NotificaMe.
 * 
 * REGRA ÚNICA DE AUTENTICAÇÃO:
 * - 1 token por tenant/canal (armazenado em channels.provider_config.api_key)
 * - 1 header: X-API-Token
 * - 1 baseUrl: https://api.notificame.com.br/v1
 * 
 * IMPORTANTE: Tokens são configurados APENAS por canal.
 * Não usar variáveis de ambiente globais para tokens de cliente.
 * 
 * SEGURANÇA:
 * - Nunca logar token completo (apenas últimos 4 caracteres)
 * - Nunca expor token em responses
 * - Token criptografado em repouso (campo provider_config)
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

export interface ChannelConfig {
  api_key?: string;
  subscription_id?: string;
}

// ===========================================
// EXTRAÇÃO E SANITIZAÇÃO DE TOKEN
// ===========================================

/**
 * Extrai e sanitiza o token de várias formas possíveis de input.
 * Suporta: token puro, comando curl, JSON, header
 * 
 * IMPORTANTE: Aceita tokens de QUALQUER formato (UUID, JWT, string longa).
 * O token oficial do NotificaMe É um UUID!
 */
export function extractToken(raw: string | undefined | null): string {
  if (!raw) return '';
  
  // Keep only ASCII printable characters
  let clean = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 32 && code <= 126) clean += raw[i];
  }
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Pattern A: Extract from curl command or header format
  const headerMatch = clean.match(/(?:X-API-Token|Authorization)[\s:]+['"]?(?:Bearer\s+)?([A-Za-z0-9_.-]+)['"]?/i);
  if (headerMatch?.[1] && headerMatch[1].length >= 10) {
    console.log('[NotificaMe] Token extracted from header/curl format');
    return headerMatch[1];
  }
  
  // Pattern B: Extract from JSON
  if (clean.startsWith('{')) {
    try {
      const parsed = JSON.parse(clean);
      const extracted = parsed.token || parsed.api_token || parsed['X-API-Token'] || parsed.access_token || parsed.api_key;
      if (extracted) {
        console.log('[NotificaMe] Token extracted from JSON');
        return String(extracted).trim();
      }
    } catch {
      // Not valid JSON
    }
  }
  
  // Pattern C: UUID format (this IS the official NotificaMe token format!)
  const uuidMatch = clean.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  if (uuidMatch?.[1]) {
    console.log('[NotificaMe] Token extracted as UUID');
    return uuidMatch[1];
  }
  
  // Pattern D: Extract long alphanumeric token (may contain dots or dashes)
  const tokenMatch = clean.match(/\b([A-Za-z0-9_.-]{20,})\b/);
  if (tokenMatch?.[1]) {
    console.log('[NotificaMe] Token extracted from pattern');
    return tokenMatch[1];
  }
  
  // Pattern E: Strip "Bearer " prefix
  if (clean.toLowerCase().startsWith('bearer ')) {
    return clean.substring(7).trim();
  }
  
  // If the clean string is at least 10 chars and has no spaces, use it as-is
  if (clean.length >= 10 && !clean.includes(' ')) {
    return clean;
  }
  
  return clean;
}

/**
 * Mascara o token para logs seguros (apenas últimos 4 caracteres)
 */
export function maskToken(token: string): string {
  if (!token) return '[EMPTY]';
  if (token.length <= 8) return '[SHORT]';
  return `***${token.substring(token.length - 4)}`;
}

// ===========================================
// RESOLUÇÃO DE TOKEN POR CANAL
// ===========================================

/**
 * Resolve o token de autenticação do NotificaMe.
 * Apenas tokens configurados por canal são suportados.
 * 
 * IMPORTANTE: Não usa variáveis de ambiente globais para tokens de cliente.
 */
export function resolveToken(channelConfig?: ChannelConfig | null): string {
  // Token do canal (armazenado no banco por tenant)
  if (channelConfig?.api_key) {
    const token = extractToken(channelConfig.api_key);
    if (token) {
      console.log(`[NotificaMe] Using channel-specific token: ${maskToken(token)}`);
      return token;
    }
  }
  
  console.error('[NotificaMe] No token found in channel config');
  return '';
}

// ===========================================
// FUNÇÕES DE REQUISIÇÃO
// ===========================================

/**
 * Faz uma requisição genérica ao NotificaMe
 */
export async function notificameRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  token: string,
  body?: unknown
): Promise<NotificaMeResponse<T>> {
  if (!token) {
    return {
      success: false,
      status: 0,
      data: null as T,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Token NotificaMe não configurado. Configure o token no canal ou na variável de ambiente.',
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
    [CONFIG.AUTH_HEADER]: token,
  };

  console.log(`[NotificaMe] >>> ${method} ${url} (token: ${maskToken(token)})`);
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
      // Check for HTML response
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

    // Mask sensitive tokens in logs (any long alphanumeric string)
    const sanitizedResponse = JSON.stringify(data)
      .replace(/\b[A-Za-z0-9_.-]{50,}\b/g, '[TOKEN]')
      .substring(0, 500);
    console.log(`[NotificaMe] <<< ${response.status}: ${sanitizedResponse}`);

    if (!response.ok) {
      const errorData = data as Record<string, unknown>;
      return {
        success: false,
        status: response.status,
        data,
        error: parseError(response.status, errorData),
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

// ===========================================
// HELPERS
// ===========================================

/**
 * Mapeia erros da API NotificaMe para mensagens amigáveis
 */
function mapErrorToFriendlyMessage(status: number, code: string, originalMessage: string): string {
  // Mapeamento por código HTTP
  switch (status) {
    case 401:
    case 403:
      return 'Token inválido ou expirado. Reconecte o NotificaMe em Configurações → Canais.';
    case 404:
      return 'Canal não encontrado. Reconecte para sincronizar o canal automaticamente.';
    case 429:
      return 'Limite de envio atingido. Tente novamente em instantes.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Instabilidade no provedor. Tentaremos novamente.';
  }
  
  // Mapeamento por código de erro
  const lowerCode = code.toLowerCase();
  if (lowerCode.includes('authentication') || lowerCode.includes('unauthorized')) {
    return 'Token inválido ou expirado. Reconecte o NotificaMe em Configurações → Canais.';
  }
  if (lowerCode.includes('rate_limit') || lowerCode.includes('too_many')) {
    return 'Limite de envio atingido. Tente novamente em instantes.';
  }
  if (lowerCode.includes('not_found') || lowerCode.includes('channel')) {
    return 'Canal não encontrado. Verifique as configurações do canal.';
  }
  if (lowerCode.includes('invalid_phone') || lowerCode.includes('recipient')) {
    return 'Número de telefone inválido ou não existe no WhatsApp.';
  }
  if (lowerCode.includes('template')) {
    return 'Template não aprovado ou não encontrado. Verifique o status do template.';
  }
  if (lowerCode.includes('window') || lowerCode.includes('24h')) {
    return 'Janela de 24h fechada. Use um template para iniciar a conversa.';
  }
  
  // Fallback: retorna mensagem original se for curta, senão genérica
  if (originalMessage && originalMessage.length < 100) {
    return originalMessage;
  }
  
  return 'Erro ao enviar mensagem. Tente novamente.';
}

function parseError(status: number, data: Record<string, unknown>): { code: string; message: string; isRetryable: boolean } {
  const code = String(data.code || data.error || data.error_code || `HTTP_${status}`);
  const rawMessage = String(data.message || data.detail || data.error || data.error_message || 'Erro desconhecido');
  const friendlyMessage = mapErrorToFriendlyMessage(status, code, rawMessage);
  const isRetryable = status >= 500 || status === 429;
  return { code, message: friendlyMessage, isRetryable };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function buildTemplateComponents(variables: Record<string, unknown>): Array<Record<string, unknown>> {
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

// ===========================================
// FUNÇÕES DE ENVIO
// ===========================================

/**
 * Envia mensagem de texto
 */
export async function sendText(
  token: string,
  params: SendTextParams
): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
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

  const phone = normalizePhone(to);
  const payload: Record<string, unknown> = {
    from: subscriptionId,
    to: phone,
    contents: [{ type: 'text', text }],
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  console.log(`[NotificaMe] Sending text to ${phone} via subscription ${subscriptionId.substring(0, 8)}...`);

  return notificameRequest<{ id?: string; messageId?: string }>('POST', '/channels/whatsapp/messages', token, payload);
}

/**
 * Envia template
 */
export async function sendTemplate(
  token: string,
  params: SendTemplateParams
): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
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

  const phone = normalizePhone(to);
  const payload: Record<string, unknown> = {
    from: subscriptionId,
    to: phone,
    contents: [{
      type: 'template',
      templateName,
      language: { code: language },
      ...(variables && { components: buildTemplateComponents(variables) }),
    }],
  };

  console.log(`[NotificaMe] Sending template "${templateName}" to ${phone}`);

  return notificameRequest<{ id?: string; messageId?: string }>('POST', '/channels/whatsapp/messages', token, payload);
}

/**
 * Testa a conexão com o NotificaMe
 */
export async function testConnection(token: string): Promise<NotificaMeResponse<unknown>> {
  if (!token) {
    return {
      success: false,
      status: 0,
      data: null,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Token não configurado.',
        isRetryable: false,
      },
    };
  }

  // Send empty payload to test auth - expect 400/422 (auth OK, payload invalid)
  const result = await notificameRequest<{ code?: string; message?: string }>(
    'POST',
    '/channels/whatsapp/messages',
    token,
    {}
  );

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

// ===========================================
// VALIDAÇÃO E DESCOBERTA DE CANAIS
// ===========================================

export interface DiscoveredChannel {
  id: string;
  name?: string;
  phone?: string;
  type?: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  channels: DiscoveredChannel[];
}

/**
 * Valida o token e tenta descobrir automaticamente os canais/subscriptions
 * Endpoints tentados (em ordem):
 * 1. GET /subscriptions - lista de subscriptions
 * 2. GET /channels - lista de canais  
 * 3. GET /account - informações da conta
 * 4. POST /channels/whatsapp/messages {} - teste de autenticação
 */
export async function validateAndDiscoverChannels(token: string): Promise<NotificaMeResponse<ValidationResult>> {
  if (!token) {
    return {
      success: false,
      status: 0,
      data: { valid: false, message: 'Token não fornecido.', channels: [] },
      error: {
        code: 'MISSING_TOKEN',
        message: 'Token não fornecido.',
        isRetryable: false,
      },
    };
  }

  console.log(`[NotificaMe] Validating token and discovering channels...`);

  // Try to list subscriptions (most likely endpoint based on SDK)
  const subscriptionsResult = await notificameRequest<Array<{ id?: string; subscriptionId?: string; channel?: string; phone?: string; name?: string }> | { data?: Array<{ id?: string; subscriptionId?: string; channel?: string; phone?: string; name?: string }> }>(
    'GET',
    '/subscriptions',
    token
  );

  if (subscriptionsResult.success) {
    const rawData = subscriptionsResult.data;
    const subscriptions = Array.isArray(rawData) ? rawData : (rawData?.data || []);
    
    if (subscriptions.length > 0) {
      console.log(`[NotificaMe] Found ${subscriptions.length} subscriptions`);
      const channels: DiscoveredChannel[] = subscriptions.map((s: { id?: string; subscriptionId?: string; channel?: string; phone?: string; name?: string }) => ({
        id: String(s.id || s.subscriptionId || ''),
        name: s.name || s.channel,
        phone: s.phone,
        type: 'subscription',
      })).filter((c: DiscoveredChannel) => c.id);
      
      return {
        success: true,
        status: 200,
        data: {
          valid: true,
          message: `Token válido! Encontrados ${channels.length} canal(is).`,
          channels,
        },
      };
    }
  }

  // Try to list channels
  const channelsResult = await notificameRequest<Array<{ id?: string; channelId?: string; phone?: string; name?: string; displayPhone?: string }> | { data?: Array<{ id?: string; channelId?: string; phone?: string; name?: string; displayPhone?: string }> }>(
    'GET',
    '/channels',
    token
  );

  if (channelsResult.success) {
    const rawData = channelsResult.data;
    const channelsList = Array.isArray(rawData) ? rawData : (rawData?.data || []);
    
    if (channelsList.length > 0) {
      console.log(`[NotificaMe] Found ${channelsList.length} channels`);
      const channels: DiscoveredChannel[] = channelsList.map((c: { id?: string; channelId?: string; phone?: string; name?: string; displayPhone?: string }) => ({
        id: String(c.id || c.channelId || ''),
        name: c.name,
        phone: c.phone || c.displayPhone,
        type: 'channel',
      })).filter((c: DiscoveredChannel) => c.id);
      
      return {
        success: true,
        status: 200,
        data: {
          valid: true,
          message: `Token válido! Encontrados ${channels.length} canal(is).`,
          channels,
        },
      };
    }
  }

  // Try to get WhatsApp channels specifically
  const whatsappChannelsResult = await notificameRequest<Array<{ id?: string; subscriptionId?: string; phone?: string; name?: string }> | { data?: Array<{ id?: string; subscriptionId?: string; phone?: string; name?: string }> }>(
    'GET',
    '/channels/whatsapp',
    token
  );

  if (whatsappChannelsResult.success) {
    const rawData = whatsappChannelsResult.data;
    const channelsList = Array.isArray(rawData) ? rawData : (rawData?.data || []);
    
    if (channelsList.length > 0) {
      console.log(`[NotificaMe] Found ${channelsList.length} WhatsApp channels`);
      const channels: DiscoveredChannel[] = channelsList.map((c: { id?: string; subscriptionId?: string; phone?: string; name?: string }) => ({
        id: String(c.id || c.subscriptionId || ''),
        name: c.name,
        phone: c.phone,
        type: 'whatsapp',
      })).filter((c: DiscoveredChannel) => c.id);
      
      return {
        success: true,
        status: 200,
        data: {
          valid: true,
          message: `Token válido! Encontrados ${channels.length} canal(is) WhatsApp.`,
          channels,
        },
      };
    }
  }

  // Try account info endpoint
  const accountResult = await notificameRequest<{ id?: string; userId?: string; channels?: Array<{ id?: string; name?: string; phone?: string }> }>(
    'GET',
    '/account',
    token
  );

  if (accountResult.success && accountResult.data) {
    console.log(`[NotificaMe] Got account info`);
    const channels: DiscoveredChannel[] = (accountResult.data.channels || []).map(c => ({
      id: String(c.id || ''),
      name: c.name,
      phone: c.phone,
      type: 'account',
    })).filter(c => c.id);

    // Even if no channels found, token is valid
    return {
      success: true,
      status: 200,
      data: {
        valid: true,
        message: channels.length > 0 
          ? `Token válido! Encontrados ${channels.length} canal(is).`
          : 'Token válido! Nenhum canal encontrado automaticamente.',
        channels,
      },
    };
  }

  // Fallback: Test auth by sending empty message
  const testResult = await testConnection(token);

  if (testResult.success) {
    return {
      success: true,
      status: 200,
      data: {
        valid: true,
        message: 'Token válido! Descoberta automática de canais não disponível. Informe o Subscription ID manualmente.',
        channels: [],
      },
    };
  }

  // Token is invalid
  if (testResult.status === 401 || testResult.status === 403) {
    return {
      success: false,
      status: testResult.status,
      data: { valid: false, message: 'Token inválido ou expirado.', channels: [] },
      error: {
        code: 'INVALID_TOKEN',
        message: 'O token fornecido foi rejeitado pelo NotificaMe. Verifique se você copiou corretamente.',
        isRetryable: false,
      },
    };
  }

  // Unknown error
  return {
    success: false,
    status: testResult.status,
    data: { valid: false, message: testResult.error?.message || 'Erro desconhecido.', channels: [] },
    error: testResult.error || {
      code: 'UNKNOWN',
      message: 'Não foi possível validar o token.',
      isRetryable: true,
    },
  };
}

/**
 * Parseia eventos de webhook do NotificaMe
 */
export function parseWebhook(payload: Record<string, unknown>, channelPhone?: string): WebhookMessage[] {
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
// LEGACY SINGLETON (para compatibilidade)
// ===========================================

class NotificaMeClient {
  private token: string = '';
  private initialized: boolean = false;

  private init(): void {
    if (this.initialized) return;
    this.token = resolveToken();
    this.initialized = true;
  }

  hasToken(): boolean {
    this.init();
    return !!this.token;
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<NotificaMeResponse<T>> {
    this.init();
    return notificameRequest<T>(method, path, this.token, body);
  }

  async sendText(params: SendTextParams): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
    this.init();
    return sendText(this.token, params);
  }

  async sendTemplate(params: SendTemplateParams): Promise<NotificaMeResponse<{ id?: string; messageId?: string }>> {
    this.init();
    return sendTemplate(this.token, params);
  }

  async testConnection(subscriptionId?: string): Promise<NotificaMeResponse<unknown>> {
    this.init();
    return testConnection(this.token);
  }

  parseWebhook(payload: Record<string, unknown>, channelPhone?: string): WebhookMessage[] {
    return parseWebhook(payload, channelPhone);
  }
}

// Singleton export (legacy)
export const notificame = new NotificaMeClient();
