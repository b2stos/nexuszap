/**
 * NotificaMe BSP Webhook Handler
 * 
 * Endpoint público para receber eventos do WhatsApp via BSP NotificaMe.
 * 
 * Endpoints:
 * - POST /webhook-notificame?channel_id=xxx  → Recebe eventos
 * - GET  /webhook-notificame?channel_id=xxx  → Health check / Verificação Meta
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
  mapInboundToContact,
  mapInboundToConversation,
  mapInboundToMessage,
  mapStatusToUpdate,
  normalizePhone,
} from '../_shared/providers/mappers.ts';

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-signature',
};

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

interface WebhookResult {
  success: boolean;
  events_processed: number;
  messages_created: number;
  messages_updated: number;
  errors: string[];
}

interface ChannelWithProvider extends Channel {
  provider: {
    name: string;
  };
}

// ============================================
// PERSISTENCE FUNCTIONS
// ============================================

/**
 * Salva o payload bruto do webhook para auditoria
 */
async function saveWebhookEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  eventType: string,
  payload: unknown,
  messageId?: string,
  options?: {
    isInvalid?: boolean;
    invalidReason?: string;
    ipAddress?: string;
    rateLimited?: boolean;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('mt_webhook_events')
    .insert({
      tenant_id: tenantId,
      channel_id: channelId,
      provider: 'notificame',
      event_type: eventType,
      payload_raw: payload,
      message_id: messageId,
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
    console.error('[Webhook] Failed to save webhook event:', error);
    return null;
  }
  
  return data?.id || null;
}

/**
 * Marca evento como processado
 */
async function markEventProcessed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  error?: string
): Promise<void> {
  await supabase
    .from('mt_webhook_events')
    .update({
      processed: true,
      processing_error: error || null,
    })
    .eq('id', eventId);
}

/**
 * Upsert de contato a partir de evento inbound
 */
async function upsertContactFromInbound(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  phone: string,
  name?: string
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
    
    console.log(`[Webhook] Contact updated: ${existing.id}`);
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
    console.error('[Webhook] Failed to create contact:', error);
    return null;
  }
  
  console.log(`[Webhook] Contact created: ${newContact.id}`);
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
  event: InboundMessageEvent
): Promise<string | null> {
  // Buscar conversa existente (preferir open)
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, status, unread_count')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .eq('contact_id', contactId)
    .order('status', { ascending: true }) // 'open' vem antes de 'resolved'
    .limit(1)
    .maybeSingle();
  
  const preview = event.text?.substring(0, 100) || 
    (event.media ? `[${event.message_type}]` : '[mensagem]');
  
  if (existing) {
    // Atualizar conversa existente
    const newUnreadCount = (existing.unread_count || 0) + 1;
    
    await supabase
      .from('conversations')
      .update({
        last_message_at: event.timestamp.toISOString(),
        last_inbound_at: event.timestamp.toISOString(),
        last_message_preview: preview,
        unread_count: newUnreadCount,
        status: 'open', // Reabrir se estava resolvida
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    
    console.log(`[Webhook] Conversation updated: ${existing.id}, unread: ${newUnreadCount}`);
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
    console.error('[Webhook] Failed to create conversation:', error);
    return null;
  }
  
  console.log(`[Webhook] Conversation created: ${newConv.id}`);
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
  event: InboundMessageEvent
): Promise<{ id: string | null; duplicate: boolean }> {
  // Verificar duplicata por provider_message_id
  const { data: existing } = await supabase
    .from('mt_messages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider_message_id', event.provider_message_id)
    .maybeSingle();
  
  if (existing) {
    console.log(`[Webhook] Duplicate message ignored: ${event.provider_message_id}`);
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
      status: 'delivered', // Inbound já foi recebido
      created_at: event.timestamp.toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('[Webhook] Failed to insert message:', error);
    return { id: null, duplicate: false };
  }
  
  console.log(`[Webhook] Message created: ${newMessage.id}, provider_id: ${event.provider_message_id}`);
  return { id: newMessage.id, duplicate: false };
}

/**
 * Atualiza status de mensagem outbound
 */
async function updateOutboundMessageStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  event: StatusUpdateEvent
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
    console.warn(`[Webhook] Orphan status update for: ${event.provider_message_id}`);
    return false;
  }
  
  // Verificar progressão de status (não regredir)
  const statusOrder = ['queued', 'sent', 'delivered', 'read', 'failed'];
  const currentIdx = statusOrder.indexOf(message.status);
  const newIdx = statusOrder.indexOf(statusUpdate.status);
  
  // 'failed' sempre pode atualizar, senão só avança
  if (statusUpdate.status !== 'failed' && newIdx <= currentIdx) {
    console.log(`[Webhook] Status not advanced: ${message.status} -> ${statusUpdate.status}`);
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
    console.error('[Webhook] Failed to update message status:', error);
    return false;
  }
  
  console.log(`[Webhook] Message status updated: ${message.id} -> ${statusUpdate.status}`);
  return true;
}

// ============================================
// EVENT PROCESSORS
// ============================================

/**
 * Processa evento de mensagem inbound
 */
async function processInboundMessage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  event: InboundMessageEvent
): Promise<{ success: boolean; duplicate: boolean; messageId?: string }> {
  try {
    // 1. Upsert contact
    const contactId = await upsertContactFromInbound(
      supabase,
      tenantId,
      event.from_phone
    );
    
    if (!contactId) {
      return { success: false, duplicate: false };
    }
    
    // 2. Upsert conversation
    const conversationId = await upsertConversationFromInbound(
      supabase,
      tenantId,
      channelId,
      contactId,
      event
    );
    
    if (!conversationId) {
      return { success: false, duplicate: false };
    }
    
    // 3. Insert message (idempotent)
    const result = await insertInboundMessageIdempotent(
      supabase,
      tenantId,
      conversationId,
      channelId,
      contactId,
      event
    );
    
    return {
      success: result.id !== null,
      duplicate: result.duplicate,
      messageId: result.id || undefined,
    };
  } catch (error) {
    console.error('[Webhook] Error processing inbound message:', error);
    return { success: false, duplicate: false };
  }
}

/**
 * Processa evento de status update
 */
async function processStatusUpdate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  event: StatusUpdateEvent
): Promise<boolean> {
  try {
    return await updateOutboundMessageStatus(supabase, tenantId, event);
  } catch (error) {
    console.error('[Webhook] Error processing status update:', error);
    return false;
  }
}

// ============================================
// RATE LIMITING
// ============================================

// Simple in-memory rate limiting (per channel per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 100; // Max 100 requests per minute per channel
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(channelId: string): boolean {
  const now = Date.now();
  const key = channelId;
  
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
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

// ============================================
// MAIN HANDLER
// ============================================

async function handleWebhook(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const channelId = url.searchParams.get('channel_id');
  const clientIP = getClientIP(req);
  
  // Log request info
  console.log(`[Webhook] ${req.method} ${url.pathname}?${url.searchParams} from ${clientIP}`);
  
  // ===========================================
  // TEST MODE: Respond 200 quickly without channel_id
  // This allows BSP panels to verify the endpoint is alive
  // ===========================================
  if (!channelId) {
    console.log('[Webhook] Test mode - no channel_id provided');
    
    // For POST/PUT/PATCH, try to read and log body safely
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        const rawBody = await req.text();
        console.log(`[Webhook] Test mode body (${rawBody.length} chars):`, rawBody.substring(0, 500));
      } catch (e) {
        console.log('[Webhook] Test mode - could not read body:', e);
      }
    }
    
    // Return 200 OK for any method (GET, POST, HEAD, etc.)
    return new Response(
      JSON.stringify({ 
        ok: true, 
        method: req.method,
        message: 'Webhook endpoint is active. Provide channel_id for real events.',
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
  
  const supabase = getSupabaseAdmin();
  
  // Fetch channel with provider
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .select(`
      id,
      tenant_id,
      name,
      phone_number,
      status,
      provider_config,
      provider_phone_id,
      provider:providers!inner(name)
    `)
    .eq('id', channelId)
    .maybeSingle();
  
  if (channelError || !channel) {
    console.error('[Webhook] Channel not found:', channelId, channelError);
    return new Response(
      JSON.stringify({ error: 'Channel not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Cast para tipo correto
  const typedChannel = channel as unknown as ChannelWithProvider;
  const tenantId = typedChannel.tenant_id;
  const providerName = typedChannel.provider?.name || 'notificame';
  
  console.log(`[Webhook] Channel: ${typedChannel.name}, Tenant: ${tenantId}, Provider: ${providerName}`);
  
  // Rate limiting check
  if (!checkRateLimit(channelId)) {
    console.warn(`[Webhook] Rate limit exceeded for channel: ${channelId}`);
    
    // Log the rate limited attempt
    await saveWebhookEvent(
      supabase,
      tenantId,
      channelId,
      'rate_limited',
      { message: 'Rate limit exceeded' },
      undefined,
      { isInvalid: true, invalidReason: 'Rate limit exceeded', ipAddress: clientIP, rateLimited: true }
    );
    
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // GET - Health check / Meta verification
  if (req.method === 'GET') {
    // Meta webhook verification (hub.challenge)
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (mode === 'subscribe' && challenge) {
      // Verificar token se configurado
      const expectedToken = typedChannel.provider_config?.webhook_secret;
      
      if (expectedToken && token !== expectedToken) {
        console.warn('[Webhook] Invalid verify token');
        
        // Log invalid attempt
        await saveWebhookEvent(
          supabase,
          tenantId,
          channelId,
          'invalid_verify_token',
          { provided_token: token ? '***' : 'missing' },
          undefined,
          { isInvalid: true, invalidReason: 'Invalid verify token', ipAddress: clientIP }
        );
        
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
      
      console.log('[Webhook] Meta verification successful');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    
    // Health check simples
    return new Response(
      JSON.stringify({
        status: 'ok',
        channel_id: channelId,
        channel_name: typedChannel.name,
        channel_status: typedChannel.status,
        provider: providerName,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // HEAD - Quick health check (same as GET but no body)
  if (req.method === 'HEAD') {
    return new Response(null, { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
  
  // POST - Webhook event
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  
  // Parse body (handle empty or invalid body gracefully)
  let body: unknown;
  let rawBody = '';
  
  try {
    rawBody = await req.text();
  } catch (e) {
    console.warn('[Webhook] Could not read body:', e);
  }
  
  // Handle empty body
  if (!rawBody || rawBody.trim() === '') {
    console.log('[Webhook] Empty body received - returning OK');
    return new Response(
      JSON.stringify({ 
        ok: true, 
        method: req.method,
        message: 'Empty body received. Real events should have JSON payload.',
        channel_id: channelId,
        channel_name: typedChannel.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Try to parse as JSON
  try {
    body = JSON.parse(rawBody);
  } catch {
    // NotificaMe "Testar" button sends non-JSON body (form-urlencoded or plain text)
    // Return 200 OK to pass the test, but log what was received for debugging
    console.warn('[Webhook] Non-JSON body received (test mode?):', rawBody.substring(0, 200));
    return new Response(
      JSON.stringify({ 
        ok: true, 
        method: req.method,
        message: 'Body received but not JSON. For real events, send JSON payload.',
        channel_id: channelId,
        channel_name: typedChannel.name,
        body_preview: rawBody.substring(0, 100),
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Get provider
  const provider = getProvider(providerName);
  
  // Validate webhook signature (if configured)
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    
    await provider.validateWebhook({
      channel: typedChannel as unknown as Channel,
      headers,
      body,
      raw_body: rawBody,
    });
  } catch (error) {
    console.error('[Webhook] Validation failed:', error);
    // Log the attempt
    await saveWebhookEvent(supabase, tenantId, channelId, 'validation_failed', body);
    
    return new Response(
      JSON.stringify({ error: 'Webhook validation failed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Save raw webhook event
  const webhookEventId = await saveWebhookEvent(
    supabase,
    tenantId,
    channelId,
    'webhook_received',
    body
  );
  
  // Parse events
  let events: WebhookEvent[];
  
  try {
    events = provider.parseWebhook(typedChannel as unknown as Channel, body);
  } catch (error) {
    console.error('[Webhook] Parse failed:', error);
    
    if (webhookEventId) {
      await markEventProcessed(supabase, webhookEventId, `Parse error: ${error}`);
    }
    
    // Responder 200 para evitar reentrega em loop
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Parse error',
        events_processed: 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log(`[Webhook] Parsed ${events.length} events`);
  
  // Process events
  const result: WebhookResult = {
    success: true,
    events_processed: 0,
    messages_created: 0,
    messages_updated: 0,
    errors: [],
  };
  
  for (const event of events) {
    try {
      if (event.type === 'message.inbound') {
        const inboundResult = await processInboundMessage(
          supabase,
          tenantId,
          channelId,
          event
        );
        
        if (inboundResult.success) {
          result.events_processed++;
          if (!inboundResult.duplicate) {
            result.messages_created++;
          }
        } else {
          result.errors.push(`Failed to process inbound: ${event.provider_message_id}`);
        }
      } else if (event.type === 'message.status') {
        const statusResult = await processStatusUpdate(supabase, tenantId, event);
        
        if (statusResult) {
          result.events_processed++;
          result.messages_updated++;
        }
        // Não adicionar erro para status updates órfãos (é esperado às vezes)
      }
    } catch (error) {
      console.error('[Webhook] Event processing error:', error);
      result.errors.push(`Event error: ${error}`);
    }
  }
  
  // Mark webhook event as processed
  if (webhookEventId) {
    await markEventProcessed(
      supabase,
      webhookEventId,
      result.errors.length > 0 ? result.errors.join('; ') : undefined
    );
  }
  
  console.log('[Webhook] Result:', JSON.stringify(result));
  
  // Always return 200 for robustness
  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================
// ENTRY POINT
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    return await handleWebhook(req);
  } catch (error) {
    console.error('[Webhook] Unhandled error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
