/**
 * Edge Function: test-channel-connection
 * 
 * Testa a conexão com o BSP NotificaMe usando o cliente centralizado.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificame } from '../_shared/notificameClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelConfig {
  subscription_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[test-channel][${requestId}] Starting test`);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Não autenticado' } }),
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
        JSON.stringify({ success: false, error: { detail: 'Não autorizado' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { channel_id } = body;

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'channel_id é obrigatório' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, provider_config')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Canal não encontrado' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = channel.provider_config as ChannelConfig;

    // Check if client has token
    if (!notificame.hasToken()) {
      console.log(`[test-channel][${requestId}] Token not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: 'Token NotificaMe não configurado no servidor. Entre em contato com o administrador para configurar NOTIFICAME_TOKEN.',
            code: 'MISSING_SERVER_TOKEN',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription_id
    const subscriptionId = (config?.subscription_id || '').trim();

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            detail: 'Subscription ID não configurado. Edite o canal para adicionar o UUID do canal NotificaMe.',
            code: 'MISSING_SUBSCRIPTION_ID',
          } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subscription_id is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(subscriptionId)) {
      console.log(`[test-channel][${requestId}] Subscription ID format invalid`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Subscription ID inválido. Deve ser um UUID. Valor: "${subscriptionId.substring(0, 20)}..."`,
            code: 'INVALID_SUBSCRIPTION_ID_FORMAT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] Testing connection for channel ${channel_id}`);
    console.log(`[test-channel][${requestId}] Subscription ID: ${subscriptionId.substring(0, 8)}...`);

    // Test connection using centralized client
    const result = await notificame.testConnection(subscriptionId);

    if (!result.success && result.error?.code === 'INVALID_TOKEN') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Credenciais rejeitadas pelo NotificaMe (HTTP ${result.status}). O Token da API no servidor pode estar incorreto.`,
            code: `HTTP_${result.status}`,
            http_status: result.status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (result.success) {
      // Update channel status to connected
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      
      await adminSupabase
        .from('channels')
        .update({ 
          status: 'connected', 
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Token autenticado com sucesso! Credenciais válidas.`,
          http_status: result.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          detail: result.error?.message || 'Erro ao testar conexão',
          code: result.error?.code || 'UNKNOWN',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[test-channel][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { detail: error instanceof Error ? error.message : 'Erro ao testar conexão' } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
