/**
 * Edge Function: notificame-send-test
 * 
 * Envia uma mensagem de teste real via NotificaMe para validar a integração completa.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelConfig {
  subscription_id?: string;
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[send-test][${requestId}] Starting test send`);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { channel_id, phone_number, message } = body;

    if (!channel_id || !phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'channel_id e phone_number são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, provider_config, tenant_id')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Canal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = channel.provider_config as ChannelConfig;

    // Get API Token from ENV
    const apiToken = (Deno.env.get('NOTIFICAME_X_API_TOKEN') || '').trim();
    
    if (!apiToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token NotificaMe não configurado no servidor (NOTIFICAME_X_API_TOKEN).',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriptionId = (config?.subscription_id || '').trim();
    if (!subscriptionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Subscription ID não configurado no canal.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const recipientPhone = normalizePhoneNumber(phone_number);
    const testMessage = message || `🧪 Mensagem de teste do Nexus Zap - ${new Date().toLocaleString('pt-BR')}`;

    const baseUrl = 'https://api.notificame.com.br/v1';
    const endpoint = `${baseUrl}/channels/whatsapp/messages`;

    const payload = {
      from: subscriptionId,
      to: recipientPhone,
      contents: [{
        type: 'text',
        text: testMessage,
      }],
    };

    console.log(`[send-test][${requestId}] Sending to ${recipientPhone}`);
    console.log(`[send-test][${requestId}] Subscription ID: ${subscriptionId.substring(0, 8)}...`);
    console.log(`[send-test][${requestId}] POST ${endpoint}`);
    console.log(`[send-test][${requestId}] Payload:`, JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Token': apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // ignore
    }

    console.log(`[send-test][${requestId}] Response status: ${response.status}`);
    console.log(`[send-test][${requestId}] Response body: ${responseText.substring(0, 500)}`);

    // Log the test in mt_webhook_events for observability
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await adminSupabase.from('mt_webhook_events').insert({
      tenant_id: channel.tenant_id,
      channel_id: channel_id,
      provider: 'notificame',
      event_type: 'test_send',
      payload_raw: {
        request_id: requestId,
        to: recipientPhone,
        message: testMessage,
        response_status: response.status,
        response_body: responseJson || responseText.substring(0, 500),
        success: response.ok,
      },
      processed: true,
    });

    if (!response.ok) {
      const errorMessage = responseJson?.message || responseJson?.error || responseText.substring(0, 200);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Falha ao enviar (HTTP ${response.status}): ${errorMessage}`,
          http_status: response.status,
          details: {
            endpoint,
            subscription_id: subscriptionId.substring(0, 8) + '...',
            to: recipientPhone,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageId = responseJson?.id || responseJson?.messageId || 
      (responseJson?.messages as Array<{ id: string }> | undefined)?.[0]?.id;

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Mensagem enviada com sucesso para ${recipientPhone}!`,
        provider_message_id: messageId,
        http_status: response.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[send-test][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao enviar mensagem de teste',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
