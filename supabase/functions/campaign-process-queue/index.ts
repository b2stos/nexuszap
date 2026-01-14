/**
 * Campaign Process Queue - PRODUCTION GRADE
 * 
 * Edge function para processar fila de campanhas em massa.
 * Envia templates para recipients em lotes respeitando rate limits.
 * 
 * Features:
 * - Rate limiting com backoff exponencial para 429
 * - Retry automático para falhas temporárias
 * - Logs DETALHADOS para diagnóstico (request/response completo)
 * - SENT só com provider_message_id confirmado
 * - Criação de mensagem no Inbox após SENT
 * - Contadores em tempo real
 * 
 * Endpoints:
 * - POST /campaign-process-queue → Processa próximo batch da campanha
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// CONFIGURATION
// ============================================

// Rate limit configurations (messages per batch, delay between messages)
const SPEED_CONFIG = {
  slow: { batchSize: 10, delayMs: 3000, batchDelayMs: 10000 },
  normal: { batchSize: 20, delayMs: 1500, batchDelayMs: 5000 },
  fast: { batchSize: 50, delayMs: 800, batchDelayMs: 2000 },
};

// Max execution time safety margin
const MAX_EXECUTION_TIME_MS = 140000; // 140s (function has 150s limit)

// Retry configuration
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============================================
// NOTIFICAME CLIENT (inline for edge function)
// ============================================

const NOTIFICAME_BASE_URL = 'https://api.notificame.com.br/v1';
const AUTH_HEADER = 'X-API-Token';
const REQUEST_TIMEOUT = 30000;

interface SendResult {
  success: boolean;
  provider_message_id?: string;
  raw_response?: unknown; // Para diagnóstico
  error?: {
    code: string;
    message: string;
    http_status?: number;
    is_retryable: boolean;
    raw_response?: unknown;
  };
}

interface ChannelConfig {
  api_key?: string;
  subscription_id?: string;
}

/**
 * Extrai e sanitiza token de diversos formatos
 * Aceita tokens de qualquer formato (não requer formato específico)
 */
function extractToken(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let token = raw.trim();
  
  // Remove Bearer prefix
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  
  // Remove X-API-Token: prefix
  if (token.toLowerCase().startsWith('x-api-token:')) {
    token = token.slice(12).trim();
  }
  
  // Try to extract from JSON
  if (token.startsWith('{')) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.token) token = parsed.token;
      else if (parsed.api_key) token = parsed.api_key;
      else if (parsed.apiKey) token = parsed.apiKey;
    } catch { /* not JSON */ }
  }
  
  // If it's a long string without spaces, it's valid
  if (token.length >= 20 && !token.includes(' ')) {
    return token;
  }
  
  return null;
}

/**
 * Resolve token do canal (apenas config do canal, sem fallback global)
 */
function resolveToken(channelConfig?: ChannelConfig | null): string | null {
  // Token do canal apenas
  if (channelConfig?.api_key) {
    const extracted = extractToken(channelConfig.api_key);
    if (extracted) return extracted;
  }
  
  return null;
}

/**
 * Mapeia erros para mensagens amigáveis
 */
function mapErrorToFriendly(status: number, code: string, originalMessage: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Token inválido ou expirado. Reconecte o NotificaMe em Configurações → Canais.';
    case 404:
      return 'Canal não encontrado. Reconecte para sincronizar o canal automaticamente.';
    case 429:
      return 'Limite de envio atingido. Aguardando para retry.';
    default:
      if (status >= 500) {
        return 'Instabilidade no provedor. Tentaremos novamente.';
      }
  }
  
  // Code-based mappings
  const codeLC = code.toLowerCase();
  if (codeLC.includes('invalid_phone') || codeLC.includes('phone')) {
    return 'Número de telefone inválido ou não cadastrado no WhatsApp.';
  }
  if (codeLC.includes('template') && codeLC.includes('not_approved')) {
    return 'Template não aprovado. Verifique o status na Meta.';
  }
  if (codeLC.includes('window') || codeLC.includes('24h')) {
    return 'Janela de 24h fechada. Use um template aprovado.';
  }
  
  return originalMessage || 'Erro ao enviar mensagem.';
}

/**
 * Determina se o erro é retryable
 */
function isRetryable(status: number, code: string): boolean {
  // Rate limit - always retry with backoff
  if (status === 429) return true;
  
  // Server errors - usually temporary
  if (status >= 500) return true;
  
  // Network/timeout errors
  if (code.includes('timeout') || code.includes('network')) return true;
  
  // Auth errors - not retryable (need reconfiguration)
  if (status === 401 || status === 403) return false;
  
  // Invalid phone - not retryable
  if (code.includes('phone') || code.includes('invalid')) return false;
  
  return false;
}

/**
 * Calcula delay de backoff exponencial com jitter
 */
function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Constrói components para API do WhatsApp
 */
function buildComponents(variables: Record<string, unknown>): Array<{type: string; parameters: Array<{type: string; text: string}>}> {
  const components: Array<{type: string; parameters: Array<{type: string; text: string}>}> = [];
  
  if (variables.body && Array.isArray(variables.body)) {
    components.push({
      type: 'body',
      parameters: variables.body.map((v: {type?: string; value: string}) => ({
        type: v.type || 'text',
        text: v.value || '',
      })),
    });
  }
  
  if (variables.header && Array.isArray(variables.header)) {
    components.push({
      type: 'header',
      parameters: variables.header.map((v: {type?: string; value: string}) => ({
        type: v.type || 'text',
        text: v.value || '',
      })),
    });
  }
  
  return components;
}

/**
 * EXTRAI MESSAGE_ID da resposta do provedor
 * Tenta múltiplos formatos conhecidos
 */
function extractMessageId(responseData: unknown): string | null {
  if (!responseData || typeof responseData !== 'object') {
    return null;
  }
  
  const data = responseData as Record<string, unknown>;
  
  // Formato 1: { message_id: "xxx" }
  if (data.message_id && typeof data.message_id === 'string') {
    return data.message_id;
  }
  
  // Formato 2: { messageId: "xxx" }
  if (data.messageId && typeof data.messageId === 'string') {
    return data.messageId;
  }
  
  // Formato 3: { id: "xxx" } (mas NÃO se for UUID de erro)
  if (data.id && typeof data.id === 'string' && !data.error) {
    return data.id;
  }
  
  // Formato 4: { messages: [{ id: "xxx" }] } (WhatsApp Cloud API)
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    const firstMsg = data.messages[0];
    if (firstMsg && typeof firstMsg === 'object') {
      const msg = firstMsg as Record<string, unknown>;
      if (msg.id && typeof msg.id === 'string') {
        return msg.id;
      }
    }
  }
  
  // Formato 5: { data: { id: "xxx" } }
  if (data.data && typeof data.data === 'object') {
    const inner = data.data as Record<string, unknown>;
    if (inner.id && typeof inner.id === 'string') {
      return inner.id;
    }
    if (inner.message_id && typeof inner.message_id === 'string') {
      return inner.message_id;
    }
    if (inner.messageId && typeof inner.messageId === 'string') {
      return inner.messageId;
    }
  }
  
  // Formato 6: { result: { id: "xxx" } }
  if (data.result && typeof data.result === 'object') {
    const inner = data.result as Record<string, unknown>;
    if (inner.id && typeof inner.id === 'string') {
      return inner.id;
    }
  }
  
  // Formato 7: { providerMessageId: "xxx" } (NotificaMe nativo)
  if (data.providerMessageId && typeof data.providerMessageId === 'string') {
    return data.providerMessageId;
  }
  
  console.log('[extractMessageId] Could not find message_id in response structure:', JSON.stringify(data).substring(0, 500));
  return null;
}

/**
 * VERIFICA SE A RESPOSTA É UM ERRO DISFARÇADO
 * NotificaMe às vezes retorna HTTP 200 com erro no body
 */
function isErrorResponse(responseData: unknown): { isError: boolean; code: string; message: string } {
  if (!responseData || typeof responseData !== 'object') {
    return { isError: false, code: '', message: '' };
  }
  
  const data = responseData as Record<string, unknown>;
  
  // Formato 1: { error: { message: "...", code: "..." } }
  if (data.error && typeof data.error === 'object') {
    const err = data.error as Record<string, unknown>;
    return {
      isError: true,
      code: String(err.code || err.type || 'API_ERROR'),
      message: String(err.message || 'Erro retornado pela API'),
    };
  }
  
  // Formato 2: { error: "message string" }
  if (data.error && typeof data.error === 'string') {
    return {
      isError: true,
      code: 'API_ERROR',
      message: data.error,
    };
  }
  
  // Formato 3: { success: false, message: "..." }
  if (data.success === false) {
    return {
      isError: true,
      code: String(data.code || 'API_ERROR'),
      message: String(data.message || 'Operação falhou'),
    };
  }
  
  return { isError: false, code: '', message: '' };
}

/**
 * Constrói payload no formato WhatsApp Cloud API
 */
function buildWhatsAppTemplatePayload(
  subscriptionId: string,
  to: string,
  templateName: string,
  language: string,
  variables: Record<string, unknown>
): Record<string, unknown> {
  const components = buildComponents(variables);
  
  return {
    from: subscriptionId,
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: components.length > 0 ? components : undefined,
    },
  };
}

/**
 * Envia template via NotificaMe API
 * ENDPOINT CORRETO: /channels/whatsapp/messages
 * COM LOGS DETALHADOS PARA DIAGNÓSTICO
 */
async function sendTemplate(
  token: string,
  subscriptionId: string,
  to: string,
  templateName: string,
  language: string,
  variables: Record<string, unknown>
): Promise<SendResult> {
  // ENDPOINT CORRETO - mesmo que sendText
  const url = `${NOTIFICAME_BASE_URL}/channels/whatsapp/messages`;
  
  // Payload no formato WhatsApp Cloud API via NotificaMe
  const body = buildWhatsAppTemplatePayload(subscriptionId, to, templateName, language, variables);
  
  // LOG ESTRUTURADO: REQUEST
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║ OUTBOUND REQUEST (Template)                                    ║
╠════════════════════════════════════════════════════════════════╣
║ URL: ${url}
║ Method: POST
║ To: ${to}
║ From (subscription_id): ${subscriptionId.substring(0, 8)}...
║ Template: ${templateName}
║ Language: ${language}
║ Token (last 4): ***${token.slice(-4)}
║ Body: ${JSON.stringify(body).substring(0, 400)}...
╚════════════════════════════════════════════════════════════════╝`);
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [AUTH_HEADER]: token,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    const latencyMs = Date.now() - startTime;
    const responseText = await response.text();
    // deno-lint-ignore no-explicit-any
    let responseData: any = {};
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    // LOG ESTRUTURADO: RESPONSE
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║ OUTBOUND RESPONSE                                              ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ${response.status} ${response.statusText}
║ Latency: ${latencyMs}ms
║ Body: ${JSON.stringify(responseData).substring(0, 500)}
╚════════════════════════════════════════════════════════════════╝`);
    
    // VERIFICAR SE É ERRO DISFARÇADO (200 com erro no body)
    const errorCheck = isErrorResponse(responseData);
    if (errorCheck.isError) {
      console.error(`[sendTemplate] ⚠️ API returned ${response.status} but body contains error!`);
      console.error(`[sendTemplate] Error: ${errorCheck.code}: ${errorCheck.message}`);
      
      return {
        success: false,
        raw_response: responseData,
        error: {
          code: errorCheck.code,
          message: errorCheck.message,
          http_status: response.status,
          is_retryable: false,
          raw_response: responseData,
        },
      };
    }
    
    if (response.ok) {
      // EXTRAIR message_id COM FUNÇÃO ROBUSTA
      const messageId = extractMessageId(responseData);
      
      if (!messageId) {
        // RESPOSTA 200 MAS SEM MESSAGE_ID = MARCAR COMO PENDING
        console.warn(`[sendTemplate] ⚠️ API returned 200 but NO message_id found`);
        console.warn(`[sendTemplate] Full response:`, JSON.stringify(responseData));
        
        // Gerar correlationId para rastreamento
        const correlationId = crypto.randomUUID();
        console.log(`[sendTemplate] Generated correlationId for tracking: ${correlationId}`);
        
        return {
          success: false,
          raw_response: responseData,
          error: {
            code: 'NO_MESSAGE_ID',
            message: 'API retornou sucesso mas sem ID da mensagem. Verifique o payload ou aguarde webhook.',
            http_status: response.status,
            is_retryable: false,
            raw_response: responseData,
          },
        };
      }
      
      console.log(`[sendTemplate] ✅ CONFIRMED SENT, message_id: ${messageId}`);
      
      return {
        success: true,
        provider_message_id: messageId,
        raw_response: responseData,
      };
    }
    
    // ERRO HTTP
    const errorCode = (responseData.error?.code || responseData.code || `HTTP_${response.status}`) as string;
    const errorMessage = (responseData.error?.message || responseData.message || response.statusText) as string;
    
    console.log(`[sendTemplate] ❌ Failed: ${response.status} - ${errorCode}: ${errorMessage}`);
    
    return {
      success: false,
      raw_response: responseData,
      error: {
        code: errorCode,
        message: mapErrorToFriendly(response.status, errorCode, errorMessage),
        http_status: response.status,
        is_retryable: isRetryable(response.status, errorCode),
        raw_response: responseData,
      },
    };
    
  } catch (err) {
    clearTimeout(timeout);
    const errorCode = err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    console.error(`[sendTemplate] Exception:`, err);
    
    return {
      success: false,
      error: {
        code: errorCode,
        message: 'Erro de conexão. Tentaremos novamente.',
        http_status: 0,
        is_retryable: true,
      },
    };
  }
}

// ============================================
// TYPES
// ============================================

interface ProcessRequest {
  campaign_id: string;
  speed?: 'slow' | 'normal' | 'fast';
}

interface CampaignData {
  id: string;
  tenant_id: string;
  channel_id: string;
  template_id: string;
  name: string;
  status: string;
  template_variables: Record<string, string> | null;
  template: {
    id: string;
    name: string;
    language: string;
    status: string;
    variables_schema: unknown;
    components?: unknown;
  };
  channel: {
    id: string;
    tenant_id: string;
    name: string;
    phone_number: string | null;
    status: string;
    provider_config: ChannelConfig | null;
    provider_phone_id: string | null;
    provider: { name: string };
  };
}

interface RecipientData {
  id: string;
  contact_id: string;
  campaign_id: string;
  status: string;
  attempts: number;
  variables: Record<string, string> | null;
  contact: {
    id: string;
    phone: string;
    name: string | null;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

interface TemplateVariable {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  value: string;
}

function buildTemplateVariables(
  // deno-lint-ignore no-explicit-any
  variablesSchema: Record<string, any[]> | null,
  recipientVars: Record<string, string> | null,
  campaignVars: Record<string, string> | null,
  contactName: string | null
): Record<string, TemplateVariable[]> {
  if (!variablesSchema) return {};
  
  const result: Record<string, TemplateVariable[]> = {};
  
  // Merge variables (recipient takes precedence)
  const mergedVars: Record<string, string> = {
    ...campaignVars,
    ...recipientVars,
    nome: contactName || recipientVars?.nome || campaignVars?.nome || '',
    name: contactName || recipientVars?.name || campaignVars?.name || '',
  };
  
  // Build body variables
  if (Array.isArray(variablesSchema.body)) {
    result.body = variablesSchema.body.map((v: {type?: string; key?: string}, idx: number) => ({
      type: (v.type || 'text') as TemplateVariable['type'],
      value: mergedVars[v.key as string] || mergedVars[`${idx + 1}`] || `{{${idx + 1}}}`,
    }));
  }
  
  return result;
}

/**
 * Renderiza conteúdo do template para preview no Inbox
 */
function renderTemplatePreview(
  templateName: string,
  variables: Record<string, TemplateVariable[]>
): string {
  // Gera uma prévia básica do template
  const bodyVars = variables.body || [];
  const values = bodyVars.map((v, i) => `{{${i + 1}}}=${v.value}`).join(', ');
  return `[Template: ${templateName}] ${values}`.substring(0, 200);
}

// ============================================
// CAMPAIGN STATS LOGGER
// ============================================

interface CampaignStats {
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  retryScheduled: number;
  rateLimited: boolean;
  errors: Array<{phone: string; error: string; code: string}>;
}

function logCampaignStats(campaignName: string, stats: CampaignStats) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║ CAMPAIGN BATCH SUMMARY: ${campaignName.padEnd(37)}║
╠═══════════════════════════════════════════════════════════════╣
║ Processed:      ${String(stats.processed).padStart(5)}                                      ║
║ Success:        ${String(stats.success).padStart(5)} ✅                                     ║
║ Failed:         ${String(stats.failed).padStart(5)} ❌                                     ║
║ Retry Scheduled:${String(stats.retryScheduled).padStart(5)} 🔄                                     ║
║ Rate Limited:   ${(stats.rateLimited ? 'YES' : 'NO').padStart(5)}                                      ║
╚═══════════════════════════════════════════════════════════════╝`);
  
  if (stats.errors.length > 0) {
    console.log(`[Campaign] Errors:`);
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.phone}: [${e.code}] ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }
}

// ============================================
// INBOX INTEGRATION - Criar mensagem outbound
// ============================================

async function createOutboundMessageInInbox(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  contactId: string,
  templateName: string,
  templateVars: Record<string, TemplateVariable[]>,
  providerMessageId: string,
  sentByUserId: string | null
): Promise<{ conversationId: string | null; messageId: string | null }> {
  try {
    // 1. Buscar ou criar conversa
    let conversationId: string | null = null;
    
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('channel_id', channelId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Criar nova conversa
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          channel_id: channelId,
          contact_id: contactId,
          status: 'open',
          unread_count: 0,
          is_pinned: false,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      
      if (convError) {
        console.error('[Inbox] Failed to create conversation:', convError);
        return { conversationId: null, messageId: null };
      }
      conversationId = newConv.id;
    }
    
    // 2. Criar mensagem outbound
    const preview = renderTemplatePreview(templateName, templateVars);
    
    const { data: message, error: msgError } = await supabase
      .from('mt_messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        channel_id: channelId,
        contact_id: contactId,
        direction: 'outbound',
        type: 'template',
        content: preview,
        template_name: templateName,
        template_variables: templateVars,
        provider_message_id: providerMessageId,
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by_user_id: sentByUserId,
      })
      .select('id')
      .single();
    
    if (msgError) {
      console.error('[Inbox] Failed to create outbound message:', msgError);
      return { conversationId, messageId: null };
    }
    
    // 3. Atualizar conversa com preview
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);
    
    console.log(`[Inbox] ✅ Created outbound message in inbox: conv=${conversationId}, msg=${message.id}`);
    
    return { conversationId, messageId: message.id };
  } catch (error) {
    console.error('[Inbox] Exception creating outbound message:', error);
    return { conversationId: null, messageId: null };
  }
}

// ============================================
// MAIN PROCESSOR
// ============================================

async function processCampaignBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaign: CampaignData,
  speed: 'slow' | 'normal' | 'fast'
): Promise<{
  processed: number;
  success: number;
  failed: number;
  retryScheduled: number;
  finished: boolean;
  rateLimited: boolean;
  errors: Array<{phone: string; error: string; code: string}>;
  paused_reason?: string;
}> {
  const startTime = Date.now();
  const config = SPEED_CONFIG[speed];
  const stats: CampaignStats = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    retryScheduled: 0,
    rateLimited: false,
    errors: [],
  };
  
  console.log(`
════════════════════════════════════════════════════════════════
CAMPAIGN BATCH START
════════════════════════════════════════════════════════════════
Campaign: ${campaign.name} (${campaign.id})
Template: ${campaign.template.name}
Channel: ${campaign.channel.name} (${campaign.channel_id})
Speed: ${speed} (batch=${config.batchSize}, delay=${config.delayMs}ms)
════════════════════════════════════════════════════════════════`);
  
  // Resolve token from channel config
  const token = resolveToken(campaign.channel.provider_config);
  
  if (!token) {
    console.error(`[Campaign] ❌ No valid token found for channel ${campaign.channel_id}`);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: false, 
      rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Token not configured', code: 'NO_TOKEN' }] 
    };
  }
  
  // Get subscription_id from channel config
  const subscriptionId = campaign.channel.provider_config?.subscription_id || 
    campaign.channel.provider_phone_id;
  
  if (!subscriptionId) {
    console.error(`[Campaign] ❌ No subscription_id found for channel ${campaign.channel_id}`);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: false, 
      rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Subscription ID not configured', code: 'NO_SUBSCRIPTION' }] 
    };
  }
  
  // Validate channel status
  if (campaign.channel.status !== 'connected') {
    console.error(`[Campaign] ❌ Channel ${campaign.channel_id} not connected (status: ${campaign.channel.status})`);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: false, 
      rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Channel not connected', code: 'CHANNEL_DISCONNECTED' }] 
    };
  }
  
  // Validate template status
  if (campaign.template.status !== 'approved') {
    console.error(`[Campaign] ❌ Template ${campaign.template_id} not approved (status: ${campaign.template.status})`);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: false, 
      rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Template not approved', code: 'TEMPLATE_NOT_APPROVED' }] 
    };
  }
  
  // Fetch queued recipients (also include those scheduled for retry)
  const now = new Date().toISOString();
  const { data: recipients, error: recipientsError } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      contact_id,
      campaign_id,
      status,
      attempts,
      variables,
      contact:mt_contacts!inner(id, phone, name)
    `)
    .eq('campaign_id', campaign.id)
    .or(`status.eq.queued,and(status.eq.failed,next_retry_at.lte.${now},attempts.lt.${MAX_RETRIES})`)
    .order('created_at', { ascending: true })
    .limit(config.batchSize);
  
  if (recipientsError) {
    console.error(`[Campaign] Failed to fetch recipients:`, recipientsError);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: false, 
      rateLimited: false,
      errors: [{ phone: 'N/A', error: recipientsError.message, code: 'DB_ERROR' }] 
    };
  }
  
  if (!recipients || recipients.length === 0) {
    console.log(`[Campaign] ✅ No more queued recipients, campaign done`);
    return { 
      processed: 0, 
      success: 0, 
      failed: 0, 
      retryScheduled: 0,
      finished: true, 
      rateLimited: false,
      errors: [] 
    };
  }
  
  console.log(`[Campaign] Processing ${recipients.length} recipients...`);
  
  // Get campaign creator for message attribution
  const { data: campaignData } = await supabase
    .from('mt_campaigns')
    .select('created_by_user_id')
    .eq('id', campaign.id)
    .single();
  
  const sentByUserId = campaignData?.created_by_user_id || null;
  
  // Current backoff delay (increases on rate limit)
  let currentBackoff = 0;
  
  // Process each recipient
  for (const recipient of recipients as unknown as RecipientData[]) {
    // Check time limit
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      console.log(`[Campaign] ⏰ Time limit reached, stopping batch`);
      break;
    }
    
    // Check campaign status periodically (might have been paused/cancelled)
    if (stats.processed > 0 && stats.processed % 10 === 0) {
      const { data: currentCampaign } = await supabase
        .from('mt_campaigns')
        .select('status')
        .eq('id', campaign.id)
        .single();
      
      if (currentCampaign?.status !== 'running') {
        console.log(`[Campaign] Campaign status changed to ${currentCampaign?.status}, stopping`);
        break;
      }
    }
    
    const phone = normalizePhone(recipient.contact.phone);
    const isRetry = recipient.attempts > 0;
    
    console.log(`
────────────────────────────────────────────────────────────────
[${stats.processed + 1}/${recipients.length}] ${isRetry ? '🔄 RETRY' : '📤 SEND'}: ${phone}
Contact: ${recipient.contact.name || 'N/A'} (${recipient.contact_id})
Attempt: ${recipient.attempts + 1}/${MAX_RETRIES}
────────────────────────────────────────────────────────────────`);
    
    // Apply backoff if we hit rate limit
    if (currentBackoff > 0) {
      console.log(`[Campaign] ⏳ Backoff delay: ${currentBackoff}ms`);
      await sleep(currentBackoff);
      currentBackoff = 0; // Reset after applying
    }
    
    try {
      // Build template variables
      const templateVars = buildTemplateVariables(
        campaign.template.variables_schema as Record<string, unknown[]>,
        recipient.variables,
        campaign.template_variables,
        recipient.contact.name
      );
      
      // Send template
      const result = await sendTemplate(
        token,
        subscriptionId,
        phone,
        campaign.template.name,
        campaign.template.language || 'pt_BR',
        templateVars
      );
      
      if (result.success && result.provider_message_id) {
        // ✅ SENT CONFIRMADO COM MESSAGE_ID
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            provider_message_id: result.provider_message_id,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
            next_retry_at: null,
          })
          .eq('id', recipient.id);
        
        // 🔄 CRIAR MENSAGEM NO INBOX
        await createOutboundMessageInInbox(
          supabase,
          campaign.tenant_id,
          campaign.channel_id,
          recipient.contact_id,
          campaign.template.name,
          templateVars,
          result.provider_message_id,
          sentByUserId
        );
        
        stats.success++;
        console.log(`[Campaign] ✅ CONFIRMED SENT: ${phone}, provider_message_id: ${result.provider_message_id}`);
        
      } else {
        // ❌ FALHA (inclui caso de 200 sem message_id)
        const errorCode = result.error?.code || 'UNKNOWN';
        const errorMessage = result.error?.message || 'Unknown error';
        const httpStatus = result.error?.http_status || 0;
        
        // Check if rate limited
        if (httpStatus === 429) {
          stats.rateLimited = true;
          currentBackoff = calculateBackoff(recipient.attempts);
          console.log(`[Campaign] ⏳ Rate limited, backoff: ${currentBackoff}ms`);
        }
        
        // **CRITICAL: Check for token/auth errors - PAUSE ENTIRE CAMPAIGN**
        const isAuthError = httpStatus === 401 || 
                           httpStatus === 403 ||
                           errorCode.includes('TOKEN') ||
                           errorCode.includes('AUTH');
        
        if (isAuthError) {
          console.error(`[Campaign] 🚨 AUTH ERROR - Pausing campaign: ${errorMessage}`);
          
          // Mark this recipient as failed
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              attempts: recipient.attempts + 1,
              last_error: errorMessage,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          
          stats.failed++;
          stats.errors.push({ phone, error: errorMessage, code: errorCode });
          
          // **PAUSE THE CAMPAIGN IMMEDIATELY**
          await supabase
            .from('mt_campaigns')
            .update({
              status: 'paused',
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.id);
          
          console.log(`[Campaign] Campaign ${campaign.id} paused due to auth error`);
          
          // Return immediately - stop processing
          return { 
            processed: stats.processed + 1, 
            success: stats.success, 
            failed: stats.failed, 
            retryScheduled: stats.retryScheduled,
            finished: false, 
            rateLimited: false,
            errors: stats.errors,
            paused_reason: 'TOKEN_INVALID',
          };
        }
        
        // Check if should retry (non-auth errors)
        if (result.error?.is_retryable && recipient.attempts < MAX_RETRIES - 1) {
          const nextRetryAt = new Date(Date.now() + calculateBackoff(recipient.attempts + 1));
          
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed', // Keep as failed, will be picked up by next batch
              attempts: recipient.attempts + 1,
              last_error: errorMessage,
              next_retry_at: nextRetryAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          
          stats.retryScheduled++;
          console.log(`[Campaign] 🔄 Scheduled retry for ${phone} at ${nextRetryAt.toISOString()}`);
        } else {
          // Permanent failure (non-auth)
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              attempts: recipient.attempts + 1,
              last_error: errorMessage,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          
          stats.failed++;
          stats.errors.push({
            phone,
            error: errorMessage,
            code: errorCode,
          });
          console.log(`[Campaign] ❌ Failed permanently for ${phone}: ${errorMessage}`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      // Unexpected error - schedule retry
      if (recipient.attempts < MAX_RETRIES - 1) {
        const nextRetryAt = new Date(Date.now() + calculateBackoff(recipient.attempts + 1));
        
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            attempts: recipient.attempts + 1,
            last_error: errorMsg,
            next_retry_at: nextRetryAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        stats.retryScheduled++;
      } else {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            attempts: recipient.attempts + 1,
            last_error: errorMsg,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        stats.failed++;
        stats.errors.push({ phone, error: errorMsg, code: 'EXCEPTION' });
      }
      
      console.error(`[Campaign] Exception for ${phone}:`, err);
    }
    
    stats.processed++;
    
    // Rate limit delay between messages
    if (stats.processed < recipients.length && !stats.rateLimited) {
      await sleep(config.delayMs);
    }
  }
  
  // Update campaign counters
  const { data: counts } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaign.id);
  
  if (counts) {
    const sentCount = counts.filter((r: {status: string}) => r.status === 'sent').length;
    const deliveredCount = counts.filter((r: {status: string}) => r.status === 'delivered').length;
    const readCount = counts.filter((r: {status: string}) => r.status === 'read').length;
    const failedCount = counts.filter((r: {status: string}) => 
      r.status === 'failed' && 
      !counts.some((c: {status: string}) => c.status === 'queued')
    ).length;
    const queuedCount = counts.filter((r: {status: string}) => r.status === 'queued').length;
    
    // Count pending retries
    const pendingRetries = counts.filter((r: {status: string}) => r.status === 'failed').length - failedCount;
    
    const isFinished = queuedCount === 0 && pendingRetries === 0;
    
    await supabase
      .from('mt_campaigns')
      .update({
        sent_count: sentCount,
        delivered_count: deliveredCount,
        read_count: readCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
        // If no more queued and no pending retries, mark as done
        ...(isFinished && {
          status: 'done',
          completed_at: new Date().toISOString(),
        }),
      })
      .eq('id', campaign.id);
    
    console.log(`[Campaign] Counters: sent=${sentCount}, delivered=${deliveredCount}, read=${readCount}, failed=${failedCount}, queued=${queuedCount}, pendingRetries=${pendingRetries}`);
  }
  
  // Check if finished
  const { count: remainingCount } = await supabase
    .from('campaign_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .or('status.eq.queued,and(status.eq.failed,next_retry_at.not.is.null)');
  
  const finished = (remainingCount || 0) === 0;
  
  // Log summary
  logCampaignStats(campaign.name, stats);
  
  return { 
    processed: stats.processed, 
    success: stats.success, 
    failed: stats.failed, 
    retryScheduled: stats.retryScheduled,
    finished, 
    rateLimited: stats.rateLimited,
    errors: stats.errors 
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const body: ProcessRequest = await req.json();
    const { campaign_id, speed = 'normal' } = body;
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[Campaign] Processing: ${campaign_id}`);
    console.log(`[Campaign] Speed: ${speed}`);
    console.log(`${'═'.repeat(60)}\n`);
    
    const supabase = getSupabaseAdmin();
    
    // Fetch campaign with template and channel
    const { data: campaign, error: campaignError } = await supabase
      .from('mt_campaigns')
      .select(`
        id,
        tenant_id,
        channel_id,
        template_id,
        name,
        status,
        template_variables,
        template:mt_templates!inner(id, name, language, status, variables_schema),
        channel:channels!inner(
          id,
          tenant_id,
          name,
          phone_number,
          status,
          provider_config,
          provider_phone_id,
          provider:providers!inner(name)
        )
      `)
      .eq('id', campaign_id)
      .single();
    
    if (campaignError || !campaign) {
      console.error(`[Campaign] Campaign not found:`, campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate campaign status
    if (campaign.status !== 'running') {
      console.log(`[Campaign] Campaign not running (status: ${campaign.status})`);
      return new Response(
        JSON.stringify({ 
          error: 'Campaign not running',
          status: campaign.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process batch
    const result = await processCampaignBatch(
      supabase,
      campaign as unknown as CampaignData,
      speed
    );
    
    console.log(`
════════════════════════════════════════════════════════════════
CAMPAIGN BATCH COMPLETE
════════════════════════════════════════════════════════════════
Processed: ${result.processed}
Success:   ${result.success}
Failed:    ${result.failed}
Retry:     ${result.retryScheduled}
Finished:  ${result.finished}
Rate Limited: ${result.rateLimited}
Paused Reason: ${result.paused_reason || 'N/A'}
════════════════════════════════════════════════════════════════`);
    
    return new Response(
      JSON.stringify({
        campaign_id,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[Campaign] Error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
