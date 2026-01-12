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

    // We intentionally send an INVALID payload to a real endpoint.
    // Expected outcomes:
    // - 401/403 => invalid token
    // - 400/422 => token is accepted (payload rejected), considered OK for credential test
    const testEndpoint = `${baseUrl}/v2/channels/whatsapp/messages`;

    const testResponse = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Token': config.api_key.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const responseText = await testResponse.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // ignore
    }

    const providerMessage =
      (responseJson && (responseJson.message || responseJson.error || responseJson.detail)) ||
      responseText;

    console.log(`[test-channel] Endpoint: ${testEndpoint}`);
    console.log(`[test-channel] Response status: ${testResponse.status}`);
    console.log(`[test-channel] Response body: ${String(providerMessage).substring(0, 200)}`);

    const invalidToken =
      testResponse.status === 401 ||
      testResponse.status === 403 ||
      /invalid token/i.test(String(providerMessage));

    if (invalidToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail:
              'Token NotificaMe inválido. Vá em Configurações > Canais e atualize credenciais.',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 400/422 here is expected (payload invalid) but proves auth is working
    if (testResponse.status === 400 || testResponse.status === 422) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Credenciais autenticadas com sucesso! (validação de payload esperada)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!testResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Falha ao validar credenciais (HTTP ${testResponse.status}). ${String(providerMessage).substring(0, 120)}`,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Credenciais validadas com sucesso!' }),
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
