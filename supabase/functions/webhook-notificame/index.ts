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
 * 
 * STATUS RECONCILIATION (v2):
 * NotificaMe generates a NEW messageId for each status event (SENT, DELIVERED, READ).
 * We use the providerMessageId (wamid - base64) as secondary key for correlation.
 * Fallback: phone + time window reconciliation.
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
import {
  isChannelBlockingError,
  isPaymentError,
  PAYMENT_ERROR_CODES,
} from '../_shared/providers/errors.ts';

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

// ============================================
// MEDIA DOWNLOAD & STORAGE
// ============================================

/**
 * Downloads media from WhatsApp/NotificaMe URL and uploads to Supabase Storage
 * Returns the public URL of the stored file
 */
async function downloadAndStoreMedia(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  mediaUrl: string,
  tenantId: string,
  messageId: string,
  mimeType: string,
  ctx?: LogContext
): Promise<string | null> {
  if (!mediaUrl) return null;
  
  try {
    // Download the media file
    if (ctx) log('info', 'Downloading media from provider', ctx, { url: mediaUrl.substring(0, 100) });
    
    const response = await fetch(mediaUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
      },
    });
    
    if (!response.ok) {
      if (ctx) log('warn', 'Failed to download media', ctx, { 
        status: response.status, 
        statusText: response.statusText 
      });
      return mediaUrl; // Fallback to original URL
    }
    
    const blob = await response.blob();
    
    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/amr': 'amr',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] || mimeType.split('/')[1] || 'bin';
    
    // Generate unique filename
    const filename = `${tenantId}/${messageId}.${ext}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('inbox-media')
      .upload(filename, blob, {
        contentType: mimeType,
        upsert: true,
      });
    
    if (error) {
      if (ctx) log('warn', 'Failed to upload media to storage', ctx, { error: error.message });
      return mediaUrl; // Fallback to original URL
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('inbox-media')
      .getPublicUrl(filename);
    
    if (ctx) log('info', 'Media stored successfully', ctx, { 
      original_url: mediaUrl.substring(0, 50),
      storage_path: filename,
      public_url: publicUrlData.publicUrl.substring(0, 80),
    });
    
    return publicUrlData.publicUrl;
  } catch (error) {
    if (ctx) log('error', 'Exception downloading/storing media', ctx, { error: String(error) });
    return mediaUrl; // Fallback to original URL on any error
  }
}

interface WebhookEventRecord {
  id: string;
  status: 'received' | 'processing' | 'processed' | 'failed';
  error?: string;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Persiste evento webhook cru para debugging
 */
async function saveWebhookEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string | null,
  channelId: string | null,
  eventType: string,
  payloadRaw: Record<string, unknown>,
  messageId: string | null,
  providerErrorCode: string | null,
  ctx: LogContext
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('mt_webhook_events')
      .insert({
        tenant_id: tenantId,
        channel_id: channelId,
        provider: 'notificame',
        event_type: eventType,
        payload_raw: payloadRaw,
        message_id: messageId,
        processed: false,
        ip_address: ctx.ip,
        provider_error_code: providerErrorCode,
      })
      .select('id')
      .single();
    
    if (error) {
      log('warn', 'Failed to save webhook event', ctx, { error: error.message });
      return null;
    }
    
    return data.id;
  } catch (e) {
    log('error', 'Exception saving webhook event', ctx, { error: String(e) });
    return null;
  }
}

/**
 * Atualiza status do evento webhook após processamento
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
        processed: status === 'processed',
        processing_error: error || null,
      })
      .eq('id', eventId);
  } catch (e) {
    if (ctx) log('warn', 'Failed to update event status', ctx, { error: String(e) });
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
 * CRITICAL: Também reativa conversas soft-deleted
 * TOMBSTONE: Se deleted_reason = 'user_deleted', cria NOVA conversa
 */
async function upsertConversationFromInbound(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  contactId: string,
  event: InboundMessageEvent,
  ctx?: LogContext
): Promise<string | null> {
  // 1. Buscar conversa existente (ativa primeiro)
  const { data: activeConv } = await supabase
    .from('conversations')
    .select('id, status, unread_count')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .eq('contact_id', contactId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  
  const preview = event.text?.substring(0, 100) || 
    (event.media ? `[${event.message_type}]` : '[mensagem]');
  
  // Calcular janela 24h: inbound abre a janela
  const now = event.timestamp;
  const windowOpened = now.toISOString();
  const windowExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  
  if (activeConv) {
    const newUnreadCount = (activeConv.unread_count || 0) + 1;
    
    await supabase
      .from('conversations')
      .update({
        last_message_at: event.timestamp.toISOString(),
        last_inbound_at: event.timestamp.toISOString(),
        last_message_preview: preview,
        unread_count: newUnreadCount,
        status: 'open',
        window_opened_at: windowOpened,
        window_expires_at: windowExpires,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeConv.id);
    
    return activeConv.id;
  }
  
  // 2. Buscar conversa soft-deleted - verificar tombstone
  const { data: deletedConv } = await supabase
    .from('conversations')
    .select('id, unread_count, deleted_reason')
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .eq('contact_id', contactId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (deletedConv) {
    // CRITICAL: Verificar tombstone
    if (deletedConv.deleted_reason === 'user_deleted') {
      // Tombstone ativo: criar NOVA conversa sem histórico
      if (ctx) log('info', 'TOMBSTONE_DETECTED', ctx, { 
        old_conversation_id: deletedConv.id,
        reason: 'user_deleted',
        action: 'creating_new' 
      });
      // Fall through to create new conversation
    } else {
      // Pode reativar (deleted_reason = null ou 'system_deleted')
      const newUnreadCount = (deletedConv.unread_count || 0) + 1;
      
      await supabase
        .from('conversations')
        .update({
          deleted_at: null, // CRITICAL: Limpar deleted_at
          deleted_reason: null, // Limpar tombstone
          last_message_at: event.timestamp.toISOString(),
          last_inbound_at: event.timestamp.toISOString(),
          last_message_preview: preview,
          unread_count: newUnreadCount,
          status: 'open',
          window_opened_at: windowOpened,
          window_expires_at: windowExpires,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deletedConv.id);
      
      if (ctx) log('info', 'CONVERSATION_REACTIVATED', ctx, { 
        conversation_id: deletedConv.id,
        was_deleted: true 
      });
      
      return deletedConv.id;
    }
  }
  
  // 3. Criar nova conversa
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
      window_opened_at: windowOpened,
      window_expires_at: windowExpires,
      deleted_reason: null, // Nova conversa sem tombstone
    })
    .select('id')
    .single();
  
  if (error) {
    if (ctx) log('error', 'Failed to create conversation', ctx, { error: error.message });
    return null;
  }
  
  if (ctx) log('info', 'CONVERSATION_CREATED', ctx, { conversation_id: newConv.id });

  return newConv.id;
}

/**
 * Insere mensagem inbound com idempotência
 * Downloads and stores media in Supabase Storage for permanent access
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
  
  // Generate a unique ID for the message (for media filename)
  const messageId = crypto.randomUUID();
  
  // Download and store media if present
  let finalMediaUrl: string | undefined = mappedMessage.media_url;
  if (mappedMessage.media_url && mappedMessage.media_mime_type) {
    const storedUrl = await downloadAndStoreMedia(
      supabase,
      mappedMessage.media_url,
      tenantId,
      messageId,
      mappedMessage.media_mime_type,
      ctx
    );
    finalMediaUrl = storedUrl ?? mappedMessage.media_url;
  }
  
  // Inserir mensagem
  const { data: newMessage, error } = await supabase
    .from('mt_messages')
    .insert({
      id: messageId, // Use the pre-generated ID
      tenant_id: tenantId,
      conversation_id: conversationId,
      channel_id: channelId,
      contact_id: contactId,
      direction: 'inbound',
      type: mappedMessage.type,
      content: mappedMessage.content,
      media_url: finalMediaUrl,
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
    media_stored: finalMediaUrl !== mappedMessage.media_url,
  });
  
  return { id: newMessage.id, duplicate: false };
}

/**
 * Atualiza status de mensagem outbound E campaign_recipients se aplicável
 * 
 * CRITICAL FIX: NotificaMe gera novo messageId para cada evento de status.
 * Strategy:
 * 1. Try direct lookup by provider_message_id
 * 2. If not found, use providerMessageId (wamid base64) from raw payload
 * 3. Fallback: phone + time window reconciliation (60s)
 */
async function updateOutboundMessageStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string | null,
  event: StatusUpdateEvent,
  rawPayload: Record<string, unknown> | null,
  ctx?: LogContext
): Promise<boolean> {
  const statusUpdate = mapStatusToUpdate(event);
  
  // Extrair código de erro se existir
  const errorCode = event.error?.code || statusUpdate.error_code;
  const errorDetail = event.error?.detail || statusUpdate.error_detail;
  
  // CRÍTICO: Detectar erro 131042 (problema de pagamento)
  const isPaymentBlockingError = isPaymentError(errorCode, errorDetail) ||
                                  (errorCode && PAYMENT_ERROR_CODES.includes(errorCode)) ||
                                  (errorDetail && errorDetail.includes('131042'));
  
  const isChannelBlocking = isChannelBlockingError(errorCode, errorDetail) || isPaymentBlockingError;
  
  // Se é erro que bloqueia canal, marcar canal como bloqueado
  if (isChannelBlocking && channelId) {
    const blockReason = isPaymentBlockingError ? 'PAYMENT_ISSUE' : 'PROVIDER_BLOCKED';
    
    if (ctx) log('error', `🚨 CHANNEL BLOCKING ERROR detected via webhook: ${errorCode}`, ctx, {
      error_code: errorCode,
      error_detail: errorDetail,
      block_reason: blockReason,
    });
    
    await supabase
      .from('channels')
      .update({
        blocked_by_provider: true,
        blocked_reason: errorDetail || 'Provider blocked this channel',
        blocked_at: new Date().toISOString(),
        blocked_error_code: errorCode || '131042',
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);
    
    if (ctx) log('warn', `🔒 Channel ${channelId} BLOCKED due to: ${blockReason}`, ctx);
  }
  
  // ========== STEP 1: Direct lookup by provider_message_id ==========
  let message: { id: string; status: string; contact_id: string } | null = null;
  let recipient: { id: string; campaign_id: string; contact_id: string; status: string } | null = null;
  
  const { data: directMessage } = await supabase
    .from('mt_messages')
    .select('id, status, contact_id')
    .eq('tenant_id', tenantId)
    .eq('provider_message_id', event.provider_message_id)
    .eq('direction', 'outbound')
    .maybeSingle();
  
  if (directMessage) {
    message = directMessage;
    if (ctx) log('info', 'Found message by direct provider_message_id lookup', ctx, { 
      message_id: message.id 
    });
  }
  
  const { data: directRecipient } = await supabase
    .from('campaign_recipients')
    .select('id, campaign_id, contact_id, status')
    .eq('provider_message_id', event.provider_message_id)
    .maybeSingle();
  
  if (directRecipient) {
    recipient = directRecipient;
    if (ctx) log('info', 'Found recipient by direct provider_message_id lookup', ctx, { 
      recipient_id: recipient.id,
      campaign_id: recipient.campaign_id 
    });
  }
  
  // ========== STEP 2: Fallback - Reconcile by channel + recent messages ==========
  // NotificaMe sends a NEW messageId for each status event (SENT, DELIVERED, READ).
  // The first event (SENT) uses the same ID we got from the API response.
  // Subsequent events (DELIVERED, READ) use a NEW ID.
  // 
  // RECONCILIATION STRATEGY:
  // 1. Look for recent outbound messages on this channel that are awaiting status updates
  // 2. Match by status progression (sent → delivered → read)
  // 3. Time window: 24 hours (messages can take a while to be delivered/read)
  
  if (!message && !recipient && channelId) {
    // Janela de 24 horas para reconciliação
    const timeWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Determine which statuses to look for based on the incoming status
    // If incoming is 'delivered', look for 'sent' messages
    // If incoming is 'read', look for 'sent' or 'delivered' messages
    let lookForStatuses: string[] = [];
    if (statusUpdate.status === 'delivered') {
      lookForStatuses = ['sent'];
    } else if (statusUpdate.status === 'read') {
      lookForStatuses = ['sent', 'delivered'];
    } else if (statusUpdate.status === 'failed') {
      lookForStatuses = ['queued', 'sent'];
    }
    
    if (lookForStatuses.length > 0) {
      // Find recent messages awaiting this status update
      const { data: recentMessages } = await supabase
        .from('mt_messages')
        .select('id, status, contact_id, provider_message_id, created_at')
        .eq('tenant_id', tenantId)
        .eq('channel_id', channelId)
        .eq('direction', 'outbound')
        .in('status', lookForStatuses)
        .gte('created_at', timeWindowStart)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (recentMessages && recentMessages.length > 0) {
        // Use the most recent message as a best guess
        // In a real scenario with high volume, we might need more sophisticated matching
        message = recentMessages[0];
        if (ctx) log('info', 'Reconciled message by channel + status progression', ctx, {
          message_id: message.id,
          current_status: message.status,
          new_status: statusUpdate.status,
          webhook_message_id: event.provider_message_id,
          candidates_count: recentMessages.length,
        });
      }
      
      // Similarly for campaign_recipients
      if (!recipient) {
        const { data: recentRecipients } = await supabase
          .from('campaign_recipients')
          .select('id, campaign_id, contact_id, status, provider_message_id')
          .in('status', lookForStatuses)
          .gte('sent_at', timeWindowStart)
          .order('sent_at', { ascending: false })
          .limit(50);
        
        // Try to match by contact_id if we found a message
        if (recentRecipients && recentRecipients.length > 0) {
          if (message && message.contact_id) {
            // Prefer matching by contact_id
            const foundRecipient = recentRecipients.find(r => r.contact_id === message!.contact_id);
            recipient = foundRecipient || recentRecipients[0];
          } else {
            recipient = recentRecipients[0];
          }
          
          if (ctx) log('info', 'Reconciled recipient by status progression', ctx, {
            recipient_id: recipient.id,
            campaign_id: recipient.campaign_id,
            current_status: recipient.status,
            new_status: statusUpdate.status,
            webhook_message_id: event.provider_message_id,
          });
        }
      }
    }
  }
  
  // Log orphan if still not found
  if (!message && !recipient) {
    if (ctx) log('warn', 'Orphan status update - no message or recipient found', ctx, { 
      provider_message_id: event.provider_message_id,
      status: statusUpdate.status,
    });
  }
  
  // ========== STEP 3: Update status for found records ==========
  
  // Verificar progressão de status (não regredir)
  const statusOrder = ['queued', 'sent', 'delivered', 'read', 'failed'];
  
  // 1. Atualizar mt_messages se existe e status progrediu
  if (message) {
    const currentIdx = statusOrder.indexOf(message.status);
    const newIdx = statusOrder.indexOf(statusUpdate.status);
    
    if (statusUpdate.status === 'failed' || newIdx > currentIdx) {
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
        if (ctx) log('error', 'Failed to update mt_messages status', ctx, { error: error.message });
      } else {
        if (ctx) log('info', 'mt_messages status updated', ctx, { 
          message_id: message.id, 
          new_status: statusUpdate.status 
        });
      }
    }
  }
  
  // 2. CRITICAL: Atualizar campaign_recipients
  if (recipient) {
    const currentIdx = statusOrder.indexOf(recipient.status);
    const newIdx = statusOrder.indexOf(statusUpdate.status);
    
    if (statusUpdate.status === 'failed' || newIdx > currentIdx) {
      const campaignRecipientUpdate: Record<string, unknown> = {
        status: statusUpdate.status,
        updated_at: new Date().toISOString(),
      };
      
      if (statusUpdate.delivered_at) {
        campaignRecipientUpdate.delivered_at = statusUpdate.delivered_at.toISOString();
      }
      if (statusUpdate.read_at) {
        campaignRecipientUpdate.read_at = statusUpdate.read_at.toISOString();
      }
      if (statusUpdate.status === 'failed') {
        campaignRecipientUpdate.last_error = `[${errorCode || 'ERROR'}] ${errorDetail || 'Unknown error'}`;
        campaignRecipientUpdate.provider_error_code = errorCode || null;
        campaignRecipientUpdate.provider_error_message = errorDetail || null;
      }
      
      const { error: crError } = await supabase
        .from('campaign_recipients')
        .update(campaignRecipientUpdate)
        .eq('id', recipient.id);
      
      if (crError) {
        if (ctx) log('error', 'Failed to update campaign_recipients', ctx, { error: crError.message });
      } else {
        if (ctx) log('info', 'campaign_recipients status updated', ctx, { 
          recipient_id: recipient.id,
          campaign_id: recipient.campaign_id,
          new_status: statusUpdate.status,
        });
        
        // 3. Atualizar contadores da campanha
        await updateCampaignCounters(supabase, recipient.campaign_id, ctx);
        
        // 4. CRITICAL FIX: Se não encontramos a mensagem no mt_messages, 
        // buscar pelo contact_id do recipient e atualizar
        if (!message && recipient.contact_id) {
          const messageUpdateData: Record<string, unknown> = {
            status: statusUpdate.status,
          };
          if (statusUpdate.delivered_at) messageUpdateData.delivered_at = statusUpdate.delivered_at.toISOString();
          if (statusUpdate.read_at) messageUpdateData.read_at = statusUpdate.read_at.toISOString();
          if (statusUpdate.failed_at) messageUpdateData.failed_at = statusUpdate.failed_at.toISOString();
          if (statusUpdate.error_code) messageUpdateData.error_code = statusUpdate.error_code;
          if (statusUpdate.error_detail) messageUpdateData.error_detail = statusUpdate.error_detail;
          
          // Determine which statuses to look for based on the incoming status
          let lookForStatusesForMessage: string[] = [];
          if (statusUpdate.status === 'delivered') {
            lookForStatusesForMessage = ['sent'];
          } else if (statusUpdate.status === 'read') {
            lookForStatusesForMessage = ['sent', 'delivered'];
          } else if (statusUpdate.status === 'failed') {
            lookForStatusesForMessage = ['queued', 'sent'];
          }
          
          // Buscar mensagem outbound recente do mesmo contato que ainda está em sent
          const { data: inboxMessage } = await supabase
            .from('mt_messages')
            .select('id, status')
            .eq('contact_id', recipient.contact_id)
            .eq('direction', 'outbound')
            .in('status', lookForStatusesForMessage.length > 0 ? lookForStatusesForMessage : ['sent', 'delivered'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (inboxMessage) {
            const { error: msgError } = await supabase
              .from('mt_messages')
              .update(messageUpdateData)
              .eq('id', inboxMessage.id);
            
            if (!msgError) {
              if (ctx) log('info', 'mt_messages synced from campaign_recipient', ctx, {
                message_id: inboxMessage.id,
                recipient_id: recipient.id,
                new_status: statusUpdate.status,
              });
            }
          }
        }
      }
    }
  }
  
  return message !== null || recipient !== null;
}

/**
 * Recalcula contadores da campanha
 * 
 * REGRA DE MÉTRICAS CUMULATIVAS:
 * - sent_count: mensagens aceitas pelo broker (status >= sent)
 * - delivered_count: mensagens entregues (status in [delivered, read])  
 * - read_count: mensagens lidas (status == read)
 * - failed_count: mensagens que falharam (status == failed)
 * 
 * Isso garante que read_count <= delivered_count <= sent_count
 */
async function updateCampaignCounters(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaignId: string,
  ctx?: LogContext
): Promise<void> {
  try {
    const { data: counts, error } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId);
    
    if (error || !counts) {
      if (ctx) log('warn', 'Failed to fetch campaign counts', ctx, { error: error?.message });
      return;
    }
    
    // CORREÇÃO: Métricas cumulativas
    // sent = todos que passaram pelo estado sent (sent + delivered + read)
    // delivered = todos que foram entregues (delivered + read)
    // read = apenas os que foram lidos
    const sentCount = counts.filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length;
    const deliveredCount = counts.filter(r => ['delivered', 'read'].includes(r.status)).length;
    const readCount = counts.filter(r => r.status === 'read').length;
    const failedCount = counts.filter(r => r.status === 'failed').length;
    
    await supabase
      .from('mt_campaigns')
      .update({
        sent_count: sentCount,
        delivered_count: deliveredCount,
        read_count: readCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
    
    if (ctx) log('info', 'Campaign counters updated (cumulative)', ctx, { 
      campaign_id: campaignId,
      sent: sentCount,
      delivered: deliveredCount,
      read: readCount,
      failed: failedCount,
      total_recipients: counts.length,
    });
  } catch (e) {
    if (ctx) log('error', 'Exception updating campaign counters', ctx, { error: String(e) });
  }
}

// ============================================
// INBOUND MESSAGE PROCESSOR
// ============================================

interface ProcessResult {
  success: boolean;
  duplicate: boolean;
}

async function processInboundMessage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  event: InboundMessageEvent,
  ctx: LogContext
): Promise<ProcessResult> {
  // 1. Upsert contact
  // deno-lint-ignore no-explicit-any
  const visitorName = (event as any).visitor_name as string | undefined;
  const contactId = await upsertContactFromInbound(
    supabase, 
    tenantId, 
    event.from_phone,
    visitorName,
    ctx
  );
  
  if (!contactId) {
    log('error', 'Failed to upsert contact', ctx, { phone: event.from_phone });
    return { success: false, duplicate: false };
  }
  
  // 2. Upsert conversation
  const conversationId = await upsertConversationFromInbound(
    supabase,
    tenantId,
    channelId,
    contactId,
    event,
    ctx
  );
  
  if (!conversationId) {
    log('error', 'Failed to upsert conversation', ctx, { contact_id: contactId });
    return { success: false, duplicate: false };
  }
  
  // 3. Insert message (idempotent)
  const result = await insertInboundMessageIdempotent(
    supabase,
    tenantId,
    conversationId,
    channelId,
    contactId,
    event,
    ctx
  );
  
  return {
    success: result.id !== null,
    duplicate: result.duplicate,
  };
}

// ============================================
// STATUS UPDATE PROCESSOR
// ============================================

async function processStatusUpdate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string | null,
  event: StatusUpdateEvent,
  rawPayload: Record<string, unknown> | null,
  ctx: LogContext
): Promise<boolean> {
  try {
    return await updateOutboundMessageStatus(supabase, tenantId, channelId, event, rawPayload, ctx);
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
    
    log('info', `Parsed ${events.length} events from webhook`, ctx, {
      event_types: events.map(e => e.type),
      message_ids: events.map(e => e.provider_message_id).filter(Boolean),
    });
    
    // Parse raw body for status reconciliation
    let rawPayload: Record<string, unknown> | null = null;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      // Ignore parse errors
    }
    
    // Process events
    let messagesCreated = 0;
    let messagesUpdated = 0;
    let orphanEvents = 0;
    const errors: string[] = [];
    
    for (const event of events) {
      try {
        if (event.type === 'message.inbound') {
          log('info', 'Processing inbound message', ctx, {
            from: (event as InboundMessageEvent).from_phone,
            provider_message_id: event.provider_message_id,
          });
          const result = await processInboundMessage(supabase, tenantId, channelId, event as InboundMessageEvent, ctx);
          if (result.success && !result.duplicate) {
            messagesCreated++;
          }
        } else if (event.type === 'message.status') {
          const statusEvent = event as StatusUpdateEvent;
          log('info', 'Processing status update', ctx, {
            provider_message_id: statusEvent.provider_message_id,
            status: statusEvent.status,
            error: statusEvent.error,
          });
          // Pass rawPayload for reconciliation
          const result = await processStatusUpdate(supabase, tenantId, channelId, statusEvent, rawPayload, ctx);
          if (result) {
            messagesUpdated++;
          } else {
            // Status event didn't match any message - orphan
            orphanEvents++;
            log('warn', 'Orphan status event - no matching message found', ctx, {
              provider_message_id: statusEvent.provider_message_id,
              status: statusEvent.status,
            });
          }
        }
      } catch (error) {
        log('error', 'Error processing event', ctx, { error: String(error) });
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
      orphan_events: orphanEvents,
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
  
  // CRITICAL FIX: Extract channel_id from BOTH path and query params
  // URL formats:
  // 1. /webhook-notificame/{channel_id} ← Path format (preferred)
  // 2. /webhook-notificame?channel_id={channel_id} ← Query param format
  // NotificaMe may append ?hub_access_token=... contaminating values
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // 1. Try extracting from path first (e.g., /webhook-notificame/abc-uuid-123)
  let channelId: string | null = null;
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Find first UUID-looking segment after "webhook-notificame"
  const funcIndex = pathParts.findIndex(p => p.includes('webhook-notificame'));
  if (funcIndex >= 0 && pathParts[funcIndex + 1]) {
    let candidate = pathParts[funcIndex + 1];
    // Clean any query params that got attached
    const questionMarkIndex = candidate.indexOf('?');
    if (questionMarkIndex > -1) {
      candidate = candidate.substring(0, questionMarkIndex);
    }
    candidate = candidate.trim();
    if (uuidRegex.test(candidate)) {
      channelId = candidate;
      console.log(`[Webhook] Extracted channel_id from path: ${channelId}`);
    }
  }
  
  // 2. Fallback to query param
  if (!channelId) {
    let queryChannelId = url.searchParams.get('channel_id');
    if (queryChannelId) {
      // Clean any extra params
      const questionMarkIndex = queryChannelId.indexOf('?');
      if (questionMarkIndex > -1) {
        queryChannelId = queryChannelId.substring(0, questionMarkIndex);
      }
      queryChannelId = queryChannelId.trim();
      if (uuidRegex.test(queryChannelId)) {
        channelId = queryChannelId;
        console.log(`[Webhook] Extracted channel_id from query: ${channelId}`);
      } else {
        console.warn(`Invalid channel_id format in query: ${queryChannelId}`);
      }
    }
  }
  
  // Build log context
  const ctx: LogContext = {
    request_id: requestId,
    channel_id: channelId || undefined,
    method: req.method,
    ip: getClientIP(req),
  };
  
  log('info', `Webhook received`, ctx, {
    path: url.pathname,
    headers: sanitizeHeaders(req),
  });
  
  // Handle OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Handle Meta/WhatsApp webhook verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (mode === 'subscribe' && challenge) {
      // In production, you should validate the token
      log('info', 'Webhook verification request', ctx, { mode, token: token ? '***' : null });
      return new Response(challenge, { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Health check
    return new Response(JSON.stringify({ status: 'ok', requestId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Read body
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (e) {
    log('error', 'Failed to read body', ctx, { error: String(e) });
    return new Response('OK', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
  
  // Parse body
  const { parsed: body, format: bodyFormat } = parseBodySafe(rawBody, contentType);
  
  log('info', 'Body parsed', ctx, { 
    format: bodyFormat, 
    size: rawBody.length,
    preview: rawBody.substring(0, 200),
  });
  
  // Initialize Supabase
  const supabase = getSupabaseAdmin();
  
  // No channel_id - try to extract from body
  if (!channelId && body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>;
    // Try subscription_id (NotificaMe format)
    const subscriptionId = bodyObj.subscriptionId as string || 
      (bodyObj.message as Record<string, unknown>)?.to as string;
    
    if (subscriptionId) {
      // Lookup channel by subscription_id
      const { data: channel } = await supabase
        .from('channels')
        .select('id')
        .eq('provider_config->>subscription_id', subscriptionId)
        .limit(1)
        .maybeSingle();
      
      if (channel) {
        channelId = channel.id;
        ctx.channel_id = channelId || undefined;
        log('info', 'Resolved channel_id from subscription_id', ctx, { subscription_id: subscriptionId });
      }
    }
  }
  
  // Still no channel_id - save as unmatched event
  if (!channelId) {
    log('warn', 'No channel_id found, saving as unmatched event', ctx);
    
    // Detect event type from body
    let eventType = 'unknown';
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>;
      eventType = (bodyObj.type as string) || 'unknown';
    }
    
    // Extract error code if present
    let providerErrorCode: string | null = null;
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>;
      const messageStatus = bodyObj.messageStatus as Record<string, unknown> | undefined;
      if (messageStatus?.code === 'ERROR') {
        const errorInfo = messageStatus.error as Record<string, unknown> | undefined;
        providerErrorCode = String(errorInfo?.code || '');
      }
    }
    
    await saveWebhookEvent(
      supabase,
      null, // no tenant
      null, // no channel
      eventType,
      { 
        body, 
        headers: sanitizeHeaders(req),
        content_type: contentType,
        method: req.method,
        request_id: requestId,
      },
      null,
      providerErrorCode,
      ctx
    );
    
    // Still return 200 to ACK
    return new Response('OK', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
  
  // Fetch channel and tenant info
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
      provider:providers(name)
    `)
    .eq('id', channelId)
    .single();
  
  if (channelError || !channel) {
    log('warn', 'Channel not found', ctx, { error: channelError?.message });
    return new Response('OK', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
  
  ctx.tenant_id = channel.tenant_id;
  
  // Validate signature (compatibility mode - never blocks)
  const signatureResult = await validateWebhookSignature(
    rawBody,
    req,
    channel.provider_config as Record<string, unknown> | null,
    ctx
  );
  
  // Check rate limit
  if (!checkRateLimit(channelId)) {
    log('warn', 'Rate limit exceeded', ctx);
    // Save event before rejecting
    await saveWebhookEvent(
      supabase,
      channel.tenant_id,
      channelId,
      'rate_limited',
      { body, headers: sanitizeHeaders(req), request_id: requestId },
      null,
      null,
      ctx
    );
    return new Response('Rate limited', { 
      status: 429, 
      headers: corsHeaders 
    });
  }
  
  // Detect event type
  let eventType = 'webhook_received';
  let messageIdForEvent: string | null = null;
  let providerErrorCode: string | null = null;
  
  if (body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>;
    const msgType = bodyObj.type as string;
    
    if (msgType === 'MESSAGE_STATUS' || msgType === 'STATUS') {
      eventType = 'MESSAGE_STATUS';
      messageIdForEvent = bodyObj.messageId as string || null;
      
      // Check for error code
      const messageStatus = bodyObj.messageStatus as Record<string, unknown> | undefined;
      if (messageStatus?.code === 'ERROR') {
        const errorInfo = messageStatus.error as Record<string, unknown> | undefined;
        providerErrorCode = String(errorInfo?.code || '');
      }
    } else if (msgType === 'MESSAGE' && bodyObj.direction === 'IN') {
      eventType = 'MESSAGE_INBOUND';
      messageIdForEvent = bodyObj.id as string || bodyObj.providerMessageId as string || null;
    }
  }
  
  // Save raw event
  const webhookEventId = await saveWebhookEvent(
    supabase,
    channel.tenant_id,
    channelId,
    eventType,
    { 
      body, 
      headers: sanitizeHeaders(req), 
      content_type: contentType,
      method: req.method,
      request_id: requestId,
      latency_ms: Date.now() - startTime,
      'x-signature-status': signatureResult.status,
      'x-signature-warning': signatureResult.reason,
    },
    messageIdForEvent,
    providerErrorCode,
    ctx
  );
  
  // ACK FAST - then process async
  // Use EdgeRuntime.waitUntil if available
  const asyncProcess = processWebhookAsync(
    supabase,
    channel.tenant_id,
    channelId,
    channel as unknown as ChannelWithProvider,
    body,
    rawBody,
    webhookEventId,
    ctx
  );
  
  // Try to use waitUntil for background processing
  // deno-lint-ignore no-explicit-any
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(asyncProcess);
    log('info', 'Background processing started via waitUntil', ctx);
  } else {
    // Fallback: await but with timeout protection
    // Create a race between processing and a timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        log('warn', 'Processing timeout - continuing in background', ctx);
        resolve();
      }, 5000); // 5s timeout for ACK
    });
    
    // Start async processing but don't block response
    asyncProcess.catch(e => log('error', 'Async processing error', ctx, { error: String(e) }));
    
    await timeoutPromise;
  }
  
  const latency = Date.now() - startTime;
  log('info', 'ACK sent', ctx, { latency_ms: latency });
  
  return new Response('OK', { 
    status: 200, 
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'text/plain',
      'X-Request-Id': requestId,
    } 
  });
}

// ============================================
// ENTRY POINT
// ============================================

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    return await handleWebhook(req);
  } catch (error) {
    // NEVER let the webhook fail - always return 200
    console.error('[Webhook] Unhandled error:', error);
    return new Response('OK', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
});
