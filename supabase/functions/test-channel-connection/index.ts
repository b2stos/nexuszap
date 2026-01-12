/**
 * Edge Function: test-channel-connection
 * 
 * Testa a conexão com o BSP NotificaMe verificando se as credenciais estão corretas.
 * 
 * CREDENCIAIS:
 * - API Token: CENTRALIZADO no servidor via ENV: NOTIFICAME_X_API_TOKEN
 * - Subscription ID: Configurado por canal no banco de dados
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelConfig {
  subscription_id?: string;
  base_url?: string;
  // api_key is DEPRECATED - now comes from ENV: NOTIFICAME_X_API_TOKEN
  api_key?: string;
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

    // =====================================================
    // API TOKEN: CENTRALIZADO NO SERVIDOR (ENV)
    // Não mais vem do banco de dados por canal
    // =====================================================
    const apiToken = (Deno.env.get('NOTIFICAME_X_API_TOKEN') || '').trim();
    
    if (!apiToken) {
      console.log(`[test-channel][${requestId}] NOTIFICAME_X_API_TOKEN not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: 'Token NotificaMe não configurado no servidor. Entre em contato com o administrador para configurar NOTIFICAME_X_API_TOKEN.',
            code: 'MISSING_SERVER_TOKEN',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token is not JSON (common mistake)
    if (apiToken.startsWith('{') || apiToken.startsWith('[')) {
      console.log(`[test-channel][${requestId}] Token appears to be JSON, not a valid token`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: 'Token do servidor está em formato inválido (JSON). Configure apenas o token puro.',
            code: 'INVALID_TOKEN_FORMAT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // SUBSCRIPTION ID: CONFIGURADO POR CANAL
    // =====================================================
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
      console.log(`[test-channel][${requestId}] Subscription ID format invalid - not a UUID`);
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

    // =====================================================
    // BASE URL: CENTRALIZADO
    // =====================================================
    const DEFAULT_BASE_URL = 'https://api.notificame.com.br/v1';
    const baseUrl = DEFAULT_BASE_URL;

    console.log(`[test-channel][${requestId}] Testing connection for channel ${channel_id}`);
    console.log(`[test-channel][${requestId}] API Token length: ${apiToken.length}`);
    // SECURITY: Mask token in logs (show only first 6 and last 4 chars)
    const maskedToken = apiToken.length > 10 
      ? `${apiToken.substring(0, 6)}...${apiToken.substring(apiToken.length - 4)}`
      : '***';
    console.log(`[test-channel][${requestId}] API Token (masked): ${maskedToken}`);
    console.log(`[test-channel][${requestId}] Subscription ID: ${subscriptionId.substring(0, 8)}...`);

    // Test endpoint: POST /v1/channels/whatsapp/messages with empty payload
    // Expected: 401/403 = bad token, 400/422 = token OK (payload rejected)
    const testEndpoint = `${baseUrl}/channels/whatsapp/messages`;

    console.log(`[test-channel][${requestId}] >>> POST ${testEndpoint}`);

    const testResponse = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Token': apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const responseText = await testResponse.text();
    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // ignore
    }

    const providerMessage =
      (responseJson && (responseJson.message || responseJson.error || responseJson.detail)) ||
      responseText;

    console.log(`[test-channel][${requestId}] Response status: ${testResponse.status}`);
    // SECURITY: Mask any tokens that might appear in error response
    const sanitizedProviderMessage = String(providerMessage)
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT_MASKED]')
      .substring(0, 300);
    console.log(`[test-channel][${requestId}] Response body: ${sanitizedProviderMessage}`);

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
            detail: `Credenciais rejeitadas pelo NotificaMe (HTTP ${testResponse.status}). O Token da API no servidor pode estar incorreto. Contate o administrador.`,
            code: `HTTP_${testResponse.status}`,
            http_status: testResponse.status,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 400/422 here is expected (payload invalid) but proves auth is working
    if (testResponse.status === 400 || testResponse.status === 422) {
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
