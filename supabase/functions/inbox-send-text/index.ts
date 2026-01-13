/**
 * Edge Function: inbox-send-text
 * 
 * Endpoint para envio de mensagens de texto pelo Inbox.
 * Resolve token por tenant/canal do banco de dados.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken, sendText, maskToken, ChannelConfig } from '../_shared/notificameClient.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface SendTextRequest {
  conversation_id: string;
  text: string;
  reply_to_message_id?: string;
}

interface ConversationData {
  id: string;
  tenant_id: string;
  channel_id: string;
  contact_id: string;
  last_inbound_at: string | null;
  status: string;
  channel: {
    id: string;
    provider_config: ChannelConfig;
    phone_number: string;
  };
  contact: {
    id: string;
    phone: string;
    name: string | null;
  };
}

// Check if within 24h window
function isWithin24hWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  
  const lastInbound = new Date(lastInboundAt);
  const now = new Date();
  const diff = now.getTime() - lastInbound.getTime();
  const hours24 = 24 * 60 * 60 * 1000;
  
  return diff < hours24;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only POST allowed
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SendTextRequest = await req.json();
    const { conversation_id, text, reply_to_message_id } = body;

    // Validate input
    if (!conversation_id || !text?.trim()) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inbox-send-text] User ${user.id} sending to conversation ${conversation_id}`);

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (tenantError || !tenantUser) {
      console.error('[inbox-send-text] Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation with channel and contact
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        tenant_id,
        channel_id,
        contact_id,
        last_inbound_at,
        status,
        channel:channels(id, provider_config, phone_number),
        contact:mt_contacts(id, phone, name)
      `)
      .eq('id', conversation_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (convError || !conversation) {
      console.error('[inbox-send-text] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conv = conversation as unknown as ConversationData;

    // Check 24h window
    if (!isWithin24hWindow(conv.last_inbound_at)) {
      console.log('[inbox-send-text] Window closed, last_inbound_at:', conv.last_inbound_at);
      return new Response(
        JSON.stringify({ 
          error: 'window_closed',
          message: 'A janela de 24h está fechada. Use um template para iniciar/retomar a conversa.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve token from channel config (tenant-specific)
    const channelConfig = conv.channel.provider_config as ChannelConfig;
    const token = resolveToken(channelConfig);
    const subscriptionId = channelConfig?.subscription_id || '';
    
    // Validate token exists
    if (!token) {
      console.error('[inbox-send-text] No token available for channel');
      return new Response(
        JSON.stringify({ 
          error: 'missing_token',
          message: 'Token NotificaMe não configurado. Configure o token em Configurações → Canais.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subscription_id exists
    if (!subscriptionId) {
      console.error('[inbox-send-text] No subscription_id for channel');
      return new Response(
        JSON.stringify({ 
          error: 'missing_subscription_id',
          message: 'Subscription ID não configurado. Edite o canal em Configurações → Canais.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Detect common misconfiguration where api_key == subscription_id
    // This is a user error: they put the subscription_id in both fields
    if (token === subscriptionId) {
      console.error('[inbox-send-text] MISCONFIGURATION: api_key equals subscription_id! User likely pasted the same value in both fields.');
      return new Response(
        JSON.stringify({ 
          error: 'token_misconfigured',
          message: 'Configuração incorreta: O Token e o Subscription ID são iguais. O Token é seu código de autenticação da API (em Configurações → API no painel NotificaMe). O Subscription ID é o UUID do canal. Corrija em Configurações → Canais.',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inbox-send-text] Token resolved: ${maskToken(token)}, subscription: ${subscriptionId.substring(0, 8)}... for tenant ${tenantUser.tenant_id}`);

    // Create message in database as queued
    const { data: message, error: msgError } = await supabase
      .from('mt_messages')
      .insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        channel_id: conv.channel_id,
        contact_id: conv.contact_id,
        direction: 'outbound',
        type: 'text',
        content: text.trim(),
        status: 'queued',
        sent_by_user_id: user.id,
        reply_to_message_id: reply_to_message_id || null,
      })
      .select()
      .single();

    if (msgError || !message) {
      console.error('[inbox-send-text] Failed to create message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to create message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inbox-send-text] Message created: ${message.id}`);

    // Send via NotificaMe with resolved token
    const sendResult = await sendText(token, {
      subscriptionId,
      to: conv.contact.phone,
      text: text.trim(),
      replyToMessageId: undefined,
    });

    if (!sendResult.success) {
      console.error('[inbox-send-text] Send failed:', sendResult.error);
      
      // Map error code for frontend handling
      let userFriendlyError = sendResult.error?.message || 'Falha ao enviar mensagem';
      let errorCategory = 'send_failed';
      
      // Categorize error for frontend
      const errorCode = sendResult.error?.code || '';
      const httpStatus = sendResult.status;
      
      if (httpStatus === 401 || httpStatus === 403 || /auth|token|unauthorized/i.test(errorCode)) {
        errorCategory = 'authentication_error';
        userFriendlyError = 'Token inválido ou expirado. Reconecte o NotificaMe em Configurações → Canais.';
      } else if (httpStatus === 404 || /not_found|channel/i.test(errorCode)) {
        errorCategory = 'channel_not_found';
        userFriendlyError = 'Canal não encontrado. Verifique as configurações.';
      } else if (httpStatus === 429 || /rate_limit/i.test(errorCode)) {
        errorCategory = 'rate_limited';
        userFriendlyError = 'Limite de envio atingido. Tente novamente em instantes.';
      } else if (httpStatus >= 500) {
        errorCategory = 'provider_error';
        userFriendlyError = 'Instabilidade no provedor. Tentaremos novamente.';
      }
      
      // Update message as failed
      const { data: failedMessage } = await supabase
        .from('mt_messages')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_code: errorCategory.toUpperCase(),
          error_detail: userFriendlyError,
        })
        .eq('id', message.id)
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          error: errorCategory,
          message: userFriendlyError,
          is_retryable: sendResult.error?.isRetryable ?? (httpStatus >= 500 || httpStatus === 429),
          data: failedMessage || { ...message, status: 'failed' },
          debug: {
            original_code: errorCode,
            http_status: httpStatus,
          },
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract provider message ID
    const providerMessageId = sendResult.data.id || sendResult.data.messageId;

    // Update message as sent with provider_message_id
    const { data: sentMessage, error: updateError } = await supabase
      .from('mt_messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      })
      .eq('id', message.id)
      .select()
      .single();

    if (updateError) {
      console.error('[inbox-send-text] Failed to update message status:', updateError);
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.trim().substring(0, 100),
      })
      .eq('id', conversation_id);

    console.log(`[inbox-send-text] Message sent successfully: ${providerMessageId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: sentMessage || message,
        provider_message_id: providerMessageId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[inbox-send-text] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
