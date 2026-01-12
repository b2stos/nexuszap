/**
 * Edge Function: test-channel-connection
 * 
 * Testa a conexão com o BSP NotificaMe verificando se as credenciais estão corretas.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelConfig {
  api_key?: string;
  subscription_id?: string;
  base_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Validate credentials exist
    if (!config?.api_key) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { detail: 'Token da API não configurado. Edite o canal para adicionar.' } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config?.subscription_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { detail: 'Subscription ID não configurado. Edite o canal para adicionar.' } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test connection to NotificaMe API
    const baseUrl = 'https://api.notificame.com.br';
    
    console.log(`[test-channel] Testing connection for channel ${channel_id}`);
    console.log(`[test-channel] API Token length: ${config.api_key.length}`);
    console.log(`[test-channel] Subscription ID: ${config.subscription_id.substring(0, 8)}...`);

    // Try a simple authenticated request
    const testResponse = await fetch(`${baseUrl}/v2/channels/whatsapp/subscriptions/${config.subscription_id}`, {
      method: 'GET',
      headers: {
        'X-API-Token': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await testResponse.text();
    console.log(`[test-channel] Response status: ${testResponse.status}`);
    console.log(`[test-channel] Response: ${responseText.substring(0, 200)}`);

    if (testResponse.status === 401 || testResponse.status === 403) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { detail: 'Token da API inválido ou expirado. Verifique suas credenciais no painel NotificaMe.' } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (testResponse.status === 404) {
      // 404 might mean subscription not found, but auth worked
      // Try a different endpoint
      const altResponse = await fetch(`${baseUrl}/v2/channels/whatsapp/messages`, {
        method: 'OPTIONS',
        headers: {
          'X-API-Token': config.api_key,
        },
      });

      if (altResponse.status === 401 || altResponse.status === 403) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: { detail: 'Token da API inválido.' } 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If we got here, credentials seem to work
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Credenciais validadas com sucesso!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-channel] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { detail: error instanceof Error ? error.message : 'Erro ao testar conexão' } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
