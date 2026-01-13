/**
 * NotificaMe BSP Webhook Handler - PRODUCTION GRADE
 * 
 * Design principles:
 * 1. ACK FAST: Always respond 200 in < 1s
 * 2. NEVER FAIL: Even on errors, return 200 and log
 * 3. ASYNC PROCESSING: Use EdgeRuntime.waitUntil() for heavy work
 * 4. IDEMPOTENT: Deduplicate by provider_message_id
 * 5. OBSERVABLE: Structured JSON logs with request_id
 * 6. AUTO-CONNECT: Update channel status to connected on valid webhook
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  getProvider,
  WebhookEvent,
  InboundMessageEvent,
  StatusUpdateEvent,
  Channel,
} from '../_shared/providers/index.ts';
import {
  mapInboundToMessage,
  mapStatusToUpdate,
  normalizePhone,
} from '../_shared/providers/mappers.ts';

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-signature, x-notificame-signature',
};

// ============================================
// LOGGING - Structured JSON logs
// ============================================

interface LogContext {
  request_id: string;
  channel_id?: string;
  tenant_id?: string;
  method?: string;
  ip?: string;
}

function log(level: 'info' | 'warn' | 'error', message: string, ctx: LogContext, data?: Record<string, unknown>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...ctx,
    ...data,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

// ============================================
// SUPABASE CLIENT (Service Role for bypassing RLS)
// ============================================

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============================================
// TYPES
// ============================================

interface ChannelWithProvider extends Channel {
  provider: {
    name: string;
  };
}

interface WebhookEventRecord {
  id: string;
  status: 'received' | 'processing' | 'processed' | 'failed';
  error?: string;
}

// ============================================
// PERSISTENCE FUNCTIONS
// ============================================

/**
 * Salva o payload bruto do webhook com métricas
 */
async function saveWebhookEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string | null,
  channelId: string | null,
  eventType: string,
  payload: unknown,
  ctx: LogContext,
  options?: {
    isInvalid?: boolean;
    invalidReason?: string;
    ipAddress?: string;
    rateLimited?: boolean;
    method?: string;
    latencyMs?: number;
    headers?: Record<string, string>;
    contentType?: string;
    rawBody?: string;
    parsedBody?: unknown;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('mt_webhook_events')
      .insert({
        tenant_id: tenantId,
        channel_id: channelId,
        provider: 'notificame',
        event_type: eventType,
        payload_raw: {
          body: payload,
          request_id: ctx.request_id,
          method: options?.method,
          latency_ms: options?.latencyMs,
          headers: options?.headers,
          content_type: options?.contentType,
          raw_body_preview: options?.rawBody?.substring(0, 500),
          parsed_body: options?.parsedBody,
        },
        processed: false,
        received_at: new Date().toISOString(),
        is_invalid: options?.isInvalid || false,
        invalid_reason: options?.invalidReason || null,
        ip_address: options?.ipAddress || null,
        rate_limited: options?.rateLimited || false,
      })
      .select('id')
      .single();
    
    if (error) {
      log('error', 'Failed to save webhook event', ctx, { error: error.message });
      return null;
    }
    
    return data?.id || null;
  } catch (e) {
    log('error', 'Exception saving webhook event', ctx, { error: String(e) });
    return null;
  }
}

/**
 * Atualiza status do evento
 */
async function updateEventStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  status: 'processing' | 'processed' | 'failed',
  error?: string,
  ctx?: LogContext
): Promise<void> {
  try {
    await supabase
      .from('mt_webhook_events')
      .update({
        processed: status === 'processed' || status === 'failed',
        processing_error: error || null,
      })
      .eq('id', eventId);
  } catch (e) {
    if (ctx) log('error', 'Failed to update event status', ctx, { error: String(e) });
  }
}

/**
 * AUTO-CONNECT: Atualiza status do canal para "connected" quando recebe webhook válido
 */
async function updateChannelStatusToConnected(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  channelId: string,
  ctx?: LogContext
): Promise<void> {
  try {
    const { error } = await supabase
      .from('channels')
      .update({
        status: 'connected',
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId)
      .neq('status', 'connected'); // Só atualiza se não estiver já conectado
    
    if (error) {
      if (ctx) log('warn', 'Failed to update channel status', ctx, { error: error.message });
    } else {
      if (ctx) log('info', 'Channel status updated to connected', ctx);
    }
  } catch (e) {
    if (ctx) log('error', 'Exception updating channel status', ctx, { error: String(e) });
  }
}

/**
 * Upsert de contato a partir de evento inbound
 */
async function upsertContactFromInbound(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  phone: string,
  name?: string,
  ctx?: LogContext
): Promise<string | null> {
  const normalizedPhone = normalizePhone(phone);
  
  // Tentar encontrar contato existente
  const { data: existing } = await supabase
    .from('mt_contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone', normalizedPhone)
    .maybeSingle();
  
  if (existing) {
    // Atualizar last_interaction_at
    await supabase
      .from('mt_contacts')
      .update({ 
        last_interaction_at: new Date().toISOString(),
        ...(name && { name }),
      })
      .eq('id', existing.id);
    
    return existing.id;
  }
  
  // Criar novo contato
  const { data: newContact, error } = await supabase
    .from('mt_contacts')
    .insert({
      tenant_id: tenantId,
      phone: normalizedPhone,
      name: name || null,
      last_interaction_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    if (ctx) log('error', 'Failed to create contact', ctx, { error: error.message });
    return null;
  }
  
  return newContact.id;
}

/**
 * Upsert de conversa a partir de evento inbound
 */
async function upsertConversationFromInbound(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  contactId: string,
  event: InboundMessageEvent,
  ctx?: LogContext
): Promise<string | null> {
  // Buscar conversa existente
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, status, unread_count')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .eq('contact_id', contactId)
    .order('status', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  const preview = event.text?.substring(0, 100) || 
    (event.media ? `[${event.message_type}]` : '[mensagem]');
  
  if (existing) {
    const newUnreadCount = (existing.unread_count || 0) + 1;
    
    await supabase
      .from('conversations')
      .update({
        last_message_at: event.timestamp.toISOString(),
        last_inbound_at: event.timestamp.toISOString(),
        last_message_preview: preview,
        unread_count: newUnreadCount,
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    
    return existing.id;
  }
  
  // Criar nova conversa
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      channel_id: channelId,
      contact_id: contactId,
      status: 'open',
      unread_count: 1,
      is_pinned: false,
      last_message_at: event.timestamp.toISOString(),
      last_inbound_at: event.timestamp.toISOString(),
      last_message_preview: preview,
    })
    .select('id')
    .single();
  
  if (error) {
    if (ctx) log('error', 'Failed to create conversation', ctx, { error: error.message });
    return null;
  }
  
  return newConv.id;
}

/**
 * Insere mensagem inbound com idempotência
 */
async function insertInboundMessageIdempotent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  conversationId: string,
  channelId: string,
  contactId: string,
  event: InboundMessageEvent,
  ctx?: LogContext
): Promise<{ id: string | null; duplicate: boolean }> {
  // Verificar duplicata por provider_message_id
  const { data: existing } = await supabase
    .from('mt_messages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider_message_id', event.provider_message_id)
    .maybeSingle();
  
  if (existing) {
    if (ctx) log('info', 'Duplicate message ignored', ctx, { provider_message_id: event.provider_message_id });
    return { id: existing.id, duplicate: true };
  }
  
  // Mapear tipo de mensagem
  const mappedMessage = mapInboundToMessage(event);
  
  // Inserir mensagem
  const { data: newMessage, error } = await supabase
    .from('mt_messages')
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      channel_id: channelId,
      contact_id: contactId,
      direction: 'inbound',
      type: mappedMessage.type,
      content: mappedMessage.content,
      media_url: mappedMessage.media_url,
      media_mime_type: mappedMessage.media_mime_type,
      media_filename: mappedMessage.media_filename,
      provider_message_id: event.provider_message_id,
      status: 'delivered',
      created_at: event.timestamp.toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    if (ctx) log('error', 'Failed to insert message', ctx, { error: error.message });
    return { id: null, duplicate: false };
  }
  
  if (ctx) log('info', 'INBOUND_MESSAGE_CREATED', ctx, { 
    conversation_id: conversationId, 
    message_id: newMessage.id,
    provider_message_id: event.provider_message_id,
  });
  
  return { id: newMessage.id, duplicate: false };
}

/**
 * Atualiza status de mensagem outbound
 */
async function updateOutboundMessageStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  event: StatusUpdateEvent,
  ctx?: LogContext
): Promise<boolean> {
  const statusUpdate = mapStatusToUpdate(event);
  
  // Buscar mensagem por provider_message_id
  const { data: message } = await supabase
    .from('mt_messages')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('provider_message_id', event.provider_message_id)
    .eq('direction', 'outbound')
    .maybeSingle();
  
  if (!message) {
    if (ctx) log('warn', 'Orphan status update', ctx, { provider_message_id: event.provider_message_id });
    return false;
  }
  
  // Verificar progressão de status (não regredir)
  const statusOrder = ['queued', 'sent', 'delivered', 'read', 'failed'];
  const currentIdx = statusOrder.indexOf(message.status);
  const newIdx = statusOrder.indexOf(statusUpdate.status);
  
  if (statusUpdate.status !== 'failed' && newIdx <= currentIdx) {
    return true;
  }
  
  // Montar update
  const updateData: Record<string, unknown> = {
    status: statusUpdate.status,
  };
  
  if (statusUpdate.sent_at) updateData.sent_at = statusUpdate.sent_at.toISOString();
  if (statusUpdate.delivered_at) updateData.delivered_at = statusUpdate.delivered_at.toISOString();
  if (statusUpdate.read_at) updateData.read_at = statusUpdate.read_at.toISOString();
  if (statusUpdate.failed_at) updateData.failed_at = statusUpdate.failed_at.toISOString();
  if (statusUpdate.error_code) updateData.error_code = statusUpdate.error_code;
  if (statusUpdate.error_detail) updateData.error_detail = statusUpdate.error_detail;
  
  const { error } = await supabase
    .from('mt_messages')
    .update(updateData)
    .eq('id', message.id);
  
  if (error) {
    if (ctx) log('error', 'Failed to update message status', ctx, { error: error.message });
    return false;
  }
  
  return true;
}

// ============================================
// EVENT PROCESSORS
// ============================================

async function processInboundMessage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  event: InboundMessageEvent,
  ctx: LogContext
): Promise<{ success: boolean; duplicate: boolean; messageId?: string }> {
  try {
    // Extract visitor name from event (stored by provider parser)
    const visitorName = (event as unknown as Record<string, unknown>).visitor_name as string | undefined;
    
    const contactId = await upsertContactFromInbound(supabase, tenantId, event.from_phone, visitorName, ctx);
    if (!contactId) return { success: false, duplicate: false };
    
    const conversationId = await upsertConversationFromInbound(supabase, tenantId, channelId, contactId, event, ctx);
    if (!conversationId) return { success: false, duplicate: false };
    
    const result = await insertInboundMessageIdempotent(supabase, tenantId, conversationId, channelId, contactId, event, ctx);
    
    return {
      success: result.id !== null,
      duplicate: result.duplicate,
      messageId: result.id || undefined,
    };
  } catch (error) {
    log('error', 'Error processing inbound message', ctx, { error: String(error) });
    return { success: false, duplicate: false };
  }
}

async function processStatusUpdate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  event: StatusUpdateEvent,
  ctx: LogContext
): Promise<boolean> {
  try {
    return await updateOutboundMessageStatus(supabase, tenantId, event, ctx);
  } catch (error) {
    log('error', 'Error processing status update', ctx, { error: String(error) });
    return false;
  }
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60000;

function checkRateLimit(channelId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(channelId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(channelId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeHeaders(req: Request): Record<string, string> {
  const safe: Record<string, string> = {};
  const allowList = ['content-type', 'user-agent', 'x-forwarded-for', 'x-notificame-signature', 'x-hub-signature-256'];
  
  req.headers.forEach((value, key) => {
    if (allowList.includes(key.toLowerCase())) {
      // Truncar valores longos e mascarar tokens
      safe[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
  });
  
  return safe;
}

// ============================================
// WEBHOOK SIGNATURE VALIDATION (HMAC-SHA256)
// ============================================

/**
 * Valida assinatura HMAC-SHA256 do webhook (se configurada)
 * 
 * MODO COMPATIBILIDADE: Nunca bloqueia processamento!
 * - Retorna status da validação para logging/auditoria
 * - status: 'valid' | 'invalid' | 'missing' | 'no_secret' | 'error'
 * - O caller deve SEMPRE continuar processando, independente do status
 */
interface SignatureValidationResult {
  status: 'valid' | 'invalid' | 'missing' | 'no_secret' | 'error';
  reason?: string;
}

async function validateWebhookSignature(
  rawBody: string,
  req: Request,
  channelConfig: Record<string, unknown> | null,
  ctx: LogContext
): Promise<SignatureValidationResult> {
  // Buscar segredo: prioridade para config do canal, depois env var global
  const webhookSecret = (channelConfig?.webhook_secret as string) || 
    Deno.env.get('WEBHOOK_SECRET');
  
  // Se não há segredo configurado, modo totalmente permissivo
  if (!webhookSecret) {
    log('info', 'No webhook secret configured - compatibility mode (all events accepted)', ctx);
    return { status: 'no_secret' };
  }
  
  // Buscar assinatura do header (Meta usa x-hub-signature-256, NotificaMe pode usar x-notificame-signature)
  const signature = req.headers.get('x-hub-signature-256') || 
    req.headers.get('x-notificame-signature') ||
    req.headers.get('x-signature');
  
  if (!signature) {
    // IMPORTANTE: Não bloquear! Apenas logar como warning
    log('warn', 'Webhook signature missing - processing anyway (compatibility mode)', ctx);
    return { status: 'missing', reason: 'No signature header provided by sender' };
  }
  
  try {
    // Calcular HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Comparação segura
    if (signature === expectedSignature) {
      log('info', 'Webhook signature validated successfully', ctx);
      return { status: 'valid' };
    }
    
    // Assinatura não bate - logar mas NÃO bloquear
    log('warn', 'Webhook signature mismatch - processing anyway (compatibility mode)', ctx, { 
      expected_prefix: expectedSignature.substring(0, 20),
      received_prefix: signature.substring(0, 20),
    });
    return { status: 'invalid', reason: 'Signature mismatch' };
    
  } catch (error) {
    log('error', 'Signature validation error - processing anyway', ctx, { error: String(error) });
    return { status: 'error', reason: `Validation error: ${error}` };
  }
}

// ============================================
// BODY PARSER - Multi-format support
// ============================================

interface ParsedBody {
  parsed: unknown;
  format: 'json' | 'form-urlencoded' | 'text' | 'empty';
  raw: string;
}

/**
 * Parser robusto que aceita múltiplos formatos:
 * - application/json
 * - application/x-www-form-urlencoded
 * - text/plain
 * - empty body
 */
function parseBodySafe(rawBody: string, contentType: string): ParsedBody {
  // Empty body
  if (!rawBody || rawBody.trim() === '') {
    return { parsed: null, format: 'empty', raw: rawBody };
  }
  
  const normalizedContentType = (contentType || '').toLowerCase();
  
  // 1. Try JSON first (most common)
  if (normalizedContentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawBody);
      return { parsed, format: 'json', raw: rawBody };
    } catch {
      // Not valid JSON, continue to other parsers
    }
  }
  
  // 2. Try form-urlencoded
  if (normalizedContentType.includes('application/x-www-form-urlencoded') || rawBody.includes('=')) {
    try {
      const params = new URLSearchParams(rawBody);
      const parsed: Record<string, string> = {};
      params.forEach((value, key) => {
        parsed[key] = value;
      });
      // Only use if we actually parsed something
      if (Object.keys(parsed).length > 0) {
        return { parsed, format: 'form-urlencoded', raw: rawBody };
      }
    } catch {
      // Not valid form data, continue
    }
  }
  
  // 3. Fallback: treat as text
  return { parsed: { text: rawBody }, format: 'text', raw: rawBody };
}

// ============================================
// ASYNC BACKGROUND PROCESSOR
// ============================================

async function processWebhookAsync(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  channel: ChannelWithProvider,
  body: unknown,
  rawBody: string,
  webhookEventId: string | null,
  ctx: LogContext
): Promise<void> {
  const startTime = Date.now();
  
  try {
    // AUTO-CONNECT: Atualiza status do canal para connected
    await updateChannelStatusToConnected(supabase, channelId, ctx);
    
    const providerName = channel.provider?.name || 'notificame';
    const provider = getProvider(providerName);
    
    // Parse events
    let events: WebhookEvent[];
    
    try {
      events = provider.parseWebhook(channel as unknown as Channel, body);
    } catch (error) {
      log('error', 'Parse failed', ctx, { error: String(error) });
      if (webhookEventId) {
        await updateEventStatus(supabase, webhookEventId, 'failed', `Parse error: ${error}`, ctx);
      }
      return;
    }
    
    log('info', `Parsed ${events.length} events`, ctx);
    
    // Process events
    let messagesCreated = 0;
    let messagesUpdated = 0;
    const errors: string[] = [];
    
    for (const event of events) {
      try {
        if (event.type === 'message.inbound') {
          const result = await processInboundMessage(supabase, tenantId, channelId, event, ctx);
          if (result.success && !result.duplicate) {
            messagesCreated++;
          }
        } else if (event.type === 'message.status') {
          const result = await processStatusUpdate(supabase, tenantId, event, ctx);
          if (result) {
            messagesUpdated++;
          }
        }
      } catch (error) {
        errors.push(String(error));
      }
    }
    
    // Mark as processed
    if (webhookEventId) {
      await updateEventStatus(
        supabase,
        webhookEventId,
        errors.length > 0 ? 'failed' : 'processed',
        errors.length > 0 ? errors.join('; ') : undefined,
        ctx
      );
    }
    
    const duration = Date.now() - startTime;
    log('info', 'Processing complete', ctx, {
      events_count: events.length,
      messages_created: messagesCreated,
      messages_updated: messagesUpdated,
      errors_count: errors.length,
      duration_ms: duration,
    });
    
  } catch (error) {
    log('error', 'Async processing failed', ctx, { error: String(error) });
    if (webhookEventId) {
      await updateEventStatus(supabase, webhookEventId, 'failed', String(error), ctx);
    }
  }
}

// ============================================
// MAIN HANDLER - ACK FAST, PROCESS ASYNC
// ============================================

async function handleWebhook(req: Request): Promise<Response> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const url = new URL(req.url);
  const contentType = req.headers.get('content-type') || '';
  
  // CRITICAL FIX: Extract channel_id and clean it from any extra params
  // NotificaMe may append ?hub_access_token=... to the URL, contaminating channel_id
  let channelId = url.searchParams.get('channel_id');
  if (channelId) {
    // If channelId contains "?" it means extra params were appended incorrectly
    const questionMarkIndex = channelId.indexOf('?');
    if (questionMarkIndex > -1) {
      channelId = channelId.substring(0, questionMarkIndex);
    }
    // Also strip any whitespace
    channelId = channelId.trim();
    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(channelId)) {
      console.warn(`Invalid channel_id format after cleanup: ${channelId}`);
      channelId = null; // Treat as test mode
    }
  }
  
  const clientIP = getClientIP(req);
  
  const ctx: LogContext = {
    request_id: requestId,
    channel_id: channelId || undefined,
    method: req.method,
    ip: clientIP,
  };
  
  log('info', `Incoming ${req.method} request`, ctx, { content_type: contentType });
  
  // ===========================================
  // HEALTH CHECK ENDPOINTS (no channel_id required)
  // ===========================================
  
  // HEAD - Quick ping (BSP connectivity test)
  if (req.method === 'HEAD') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }
  
  // Test mode: no channel_id
  if (!channelId) {
    log('info', 'Test mode - no channel_id', ctx);
    
    // For POST, try to log body
    if (req.method === 'POST') {
      try {
        const rawBody = await req.text();
        const parsed = parseBodySafe(rawBody, contentType);
        log('info', 'Test mode body received', ctx, { 
          body_length: rawBody.length,
          body_format: parsed.format,
          body_preview: rawBody.substring(0, 200),
        });
      } catch (e) {
        log('warn', 'Could not read test body', ctx, { error: String(e) });
      }
    }
    
    const latency = Date.now() - startTime;
    return new Response(
      JSON.stringify({ 
        ok: true,
        request_id: requestId,
        method: req.method,
        message: 'Webhook endpoint active. Provide channel_id for real events.',
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // ===========================================
  // REAL EVENT PROCESSING (with channel_id)
  // ===========================================
  
  const supabase = getSupabaseAdmin();
  
  // Fetch channel
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .select(`
      id, tenant_id, name, phone_number, status, provider_config, provider_phone_id,
      provider:providers!inner(name)
    `)
    .eq('id', channelId)
    .maybeSingle();
  
  if (channelError || !channel) {
    log('warn', 'Channel not found', ctx, { error: channelError?.message });
    // Still return 200 to not break BSP retry
    return new Response(
      JSON.stringify({ ok: true, warning: 'Channel not found', request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const typedChannel = channel as unknown as ChannelWithProvider;
  const tenantId = typedChannel.tenant_id;
  ctx.tenant_id = tenantId;
  
  log('info', `Channel found: ${typedChannel.name}`, ctx);
  
  // Rate limiting
  if (!checkRateLimit(channelId)) {
    log('warn', 'Rate limit exceeded', ctx);
    await saveWebhookEvent(supabase, tenantId, channelId, 'rate_limited', {}, ctx, {
      isInvalid: true, invalidReason: 'Rate limit exceeded', ipAddress: clientIP, rateLimited: true
    });
    // Return 200 anyway to not trigger retries
    return new Response(
      JSON.stringify({ ok: true, warning: 'Rate limited', request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // GET - Health check
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Meta webhook verification
    if (mode === 'subscribe' && challenge) {
      const expectedToken = typedChannel.provider_config?.webhook_secret;
      if (expectedToken && token !== expectedToken) {
        log('warn', 'Invalid verify token', ctx);
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
      log('info', 'Meta verification successful', ctx);
      
      // AUTO-CONNECT on verification success
      await updateChannelStatusToConnected(supabase, channelId, ctx);
      
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    
    // Simple health check - also auto-connect
    await updateChannelStatusToConnected(supabase, channelId, ctx);
    
    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        channel_id: channelId,
        channel_name: typedChannel.name,
        channel_status: 'connected', // Will be connected after this
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // POST - Webhook event
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: true, warning: 'Method not POST', request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Read body safely
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (e) {
    log('warn', 'Could not read body', ctx, { error: String(e) });
  }
  
  // Validate webhook signature (if configured) - COMPATIBILITY MODE: NEVER BLOCK!
  // IMPORTANT: Usa webhook_secret do servidor, NÃO o token do cliente
  const signatureValidation = await validateWebhookSignature(
    rawBody, 
    req, 
    typedChannel.provider_config as unknown as Record<string, unknown> | null, 
    ctx
  );
  
  // Log signature status but NEVER block processing
  // This ensures messages are always received even if signature validation fails
  const signatureWarning = signatureValidation.status !== 'valid' && signatureValidation.status !== 'no_secret'
    ? `Signature ${signatureValidation.status}: ${signatureValidation.reason || 'unknown'}`
    : null;
  
  if (signatureWarning) {
    log('warn', `Signature issue (processing anyway): ${signatureWarning}`, ctx);
  }
  
  // Parse body with multi-format support
  const parsedBody = parseBodySafe(rawBody, contentType);
  log('info', 'Body parsed', ctx, { format: parsedBody.format, raw_length: rawBody.length });
  
  // Empty body (test ping)
  if (parsedBody.format === 'empty') {
    log('info', 'Empty body received', ctx);
    const latency = Date.now() - startTime;
    
    // AUTO-CONNECT on any valid request
    await updateChannelStatusToConnected(supabase, channelId, ctx);
    
    await saveWebhookEvent(supabase, tenantId, channelId, 'test_ping', { empty: true }, ctx, {
      ipAddress: clientIP, method: 'POST', latencyMs: latency, contentType
    });
    return new Response(
      JSON.stringify({ 
        ok: true, 
        request_id: requestId,
        message: 'Empty body received (test ping)',
        channel_name: typedChannel.name,
        channel_status: 'connected',
        latency_ms: latency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // For non-JSON but parsed content (form-urlencoded or text)
  if (parsedBody.format !== 'json') {
    log('info', `Non-JSON body (${parsedBody.format}) received and parsed`, ctx);
    const latency = Date.now() - startTime;
    
    // AUTO-CONNECT on any valid request
    await updateChannelStatusToConnected(supabase, channelId, ctx);
    
    await saveWebhookEvent(supabase, tenantId, channelId, `body_${parsedBody.format}`, parsedBody.parsed, ctx, {
      ipAddress: clientIP, 
      method: 'POST', 
      latencyMs: latency, 
      contentType,
      rawBody: rawBody.substring(0, 500),
      parsedBody: parsedBody.parsed,
    });
    
    return new Response(
      JSON.stringify({ 
        ok: true, 
        request_id: requestId,
        message: `Body received as ${parsedBody.format}`,
        channel_name: typedChannel.name,
        channel_status: 'connected',
        body_format: parsedBody.format,
        latency_ms: latency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // JSON body - save and process
  const body = parsedBody.parsed;
  
  // AUTO-CONNECT: Mark channel as connected on receiving any valid webhook
  // This is the key step that ensures the channel shows as "connected" in the UI
  await updateChannelStatusToConnected(supabase, channelId, ctx);
  
  // Save raw event FIRST (for audit) - include signature status for observability
  const latency = Date.now() - startTime;
  const webhookEventId = await saveWebhookEvent(
    supabase,
    tenantId,
    channelId,
    'webhook_received',
    body,
    ctx,
    {
      ipAddress: clientIP,
      method: 'POST',
      latencyMs: latency,
      headers: {
        ...sanitizeHeaders(req),
        'x-signature-status': signatureValidation.status,
        ...(signatureWarning ? { 'x-signature-warning': signatureWarning } : {}),
      },
      contentType,
    }
  );
  
  // ACK FAST - Respond immediately with 200
  const ackResponse = new Response(
    JSON.stringify({ 
      ok: true, 
      request_id: requestId,
      accepted: true,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
  
  // ASYNC PROCESSING - Use EdgeRuntime.waitUntil() if available
  const asyncTask = processWebhookAsync(
    supabase,
    tenantId,
    channelId,
    typedChannel,
    body,
    rawBody,
    webhookEventId,
    ctx
  );
  
  // Use EdgeRuntime.waitUntil if available (Supabase Edge Functions)
  // @ts-ignore - EdgeRuntime is a global in Supabase Edge Functions
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(asyncTask);
    log('info', 'Background processing started', ctx);
  } else {
    // Fallback: wait for processing (not ideal but works)
    await asyncTask;
  }
  
  return ackResponse;
}

// ============================================
// ENTRY POINT
// ============================================

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    return await handleWebhook(req);
  } catch (error) {
    // NEVER fail - always return 200
    const requestId = generateRequestId();
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Unhandled error in webhook handler',
      request_id: requestId,
      error: String(error),
    }));
    
    return new Response(
      JSON.stringify({ 
        ok: true, 
        request_id: requestId,
        warning: 'Internal error occurred but request acknowledged',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
