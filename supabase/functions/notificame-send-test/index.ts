/**
 * Edge Function: notificame-send-test
 * 
 * Envia uma mensagem de teste real via NotificaMe.
 * Resolve token por tenant/canal do banco de dados.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken, sendText, maskToken, ChannelConfig } from '../_shared/notificameClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);

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

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (tenantError || !tenantUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel (with tenant validation)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, provider_config, tenant_id')
      .eq('id', channel_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Canal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve token from channel config (tenant-specific) or fallback to env
    const channelConfig = channel.provider_config as ChannelConfig;
    const token = resolveToken(channelConfig);
    
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token NotificaMe não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriptionId = channelConfig?.subscription_id || '';

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription ID não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-test][${requestId}] Token: ${maskToken(token)}, sending to ${phone_number}`);

    const result = await sendText(token, {
      subscriptionId,
      to: phone_number,
      text: message || `🧪 Teste Nexus Zap - ${new Date().toLocaleString('pt-BR')}`,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error?.message, code: result.error?.code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Mensagem enviada para ${phone_number}!`,
        provider_message_id: result.data.id || result.data.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[send-test][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
