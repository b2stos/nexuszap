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
    const apiToken = (config.api_key || '').trim();
    const subscriptionId = (config.subscription_id || '').trim();

    console.log(`[test-channel] Testing connection for channel ${channel_id}`);
    console.log(`[test-channel] API Token length: ${apiToken.length}`);
    console.log(`[test-channel] API Token preview: ${apiToken.substring(0, 20)}...`);
    console.log(`[test-channel] Subscription ID: ${subscriptionId}`);

    // Validate token format (should be JWT-like, starting with eyJ)
    const isJwtFormat = apiToken.startsWith('eyJ') && apiToken.length >= 50;
    if (!isJwtFormat) {
      console.log(`[test-channel] Token format invalid - not a JWT`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Token inválido. O Token da API deve ser um JWT longo (começa com "eyJ"). Formato recebido: "${apiToken.substring(0, 15)}..." (${apiToken.length} chars)`,
            code: 'INVALID_TOKEN_FORMAT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subscription_id is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(subscriptionId)) {
      console.log(`[test-channel] Subscription ID format invalid - not a UUID`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Subscription ID inválido. Deve ser um UUID (ex: 066f4d91-fd0c-4726-8b1c-...). Valor recebido: "${subscriptionId.substring(0, 20)}"`,
            code: 'INVALID_SUBSCRIPTION_ID_FORMAT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // We intentionally send an INVALID payload to a real endpoint.
    // Expected outcomes:
    // - 401/403 => invalid token
    // - 400/422 => token is accepted (payload rejected), considered OK for credential test
    const testEndpoint = `${baseUrl}/v2/channels/whatsapp/messages`;

    console.log(`[test-channel] Calling endpoint: ${testEndpoint}`);
    console.log(`[test-channel] Header: X-API-Token: ${apiToken.substring(0, 20)}...`);

    const testResponse = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Token': apiToken,
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

    console.log(`[test-channel] Response status: ${testResponse.status}`);
    console.log(`[test-channel] Response body: ${String(providerMessage).substring(0, 300)}`);

    // Analyze response
    const invalidToken =
      testResponse.status === 401 ||
      testResponse.status === 403 ||
      /invalid token/i.test(String(providerMessage)) ||
      /unauthorized/i.test(String(providerMessage)) ||
      /não autorizado/i.test(String(providerMessage));

    if (invalidToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Credenciais rejeitadas pelo NotificaMe (HTTP ${testResponse.status}). Verifique se o Token da API está correto. Resposta: ${String(providerMessage).substring(0, 150)}`,
            code: `HTTP_${testResponse.status}`,
            http_status: testResponse.status,
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
          message: `✅ Token autenticado com sucesso! (HTTP ${testResponse.status} - payload de teste rejeitado, mas credenciais aceitas)`,
          http_status: testResponse.status,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!testResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Erro inesperado do NotificaMe (HTTP ${testResponse.status}). Resposta: ${String(providerMessage).substring(0, 150)}`,
            code: `HTTP_${testResponse.status}`,
            http_status: testResponse.status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `✅ Credenciais validadas com sucesso! (HTTP ${testResponse.status})`,
        http_status: testResponse.status,
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
