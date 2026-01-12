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

    // =====================================================
    // SINGLE SOURCE OF TRUTH: NotificaMe API Base URL
    // CRITICAL: Always use /v1 prefix as per official documentation
    // =====================================================
    const NOTIFICAME_API_BASE_URL = 'https://api.notificame.com.br/v1';
    
    let apiToken = (config.api_key || '').trim();
    const subscriptionId = (config.subscription_id || '').trim();

    // RELAXED VALIDATION: Extract token from JSON if pasted by mistake
    // Accept any non-empty string (NotificaMe docs don't require specific format)
    if (apiToken.startsWith('{')) {
      try {
        const parsed = JSON.parse(apiToken);
        const extracted = parsed.token || parsed.api_key || parsed.apiKey || parsed.access_token;
        if (extracted && typeof extracted === 'string') {
          console.log('[test-channel] Extracted token from JSON string');
          apiToken = extracted.trim();
        }
      } catch {
        // Not valid JSON with token field - will fail validation below
      }
    }

    console.log(`[test-channel] Testing connection for channel ${channel_id}`);
    console.log(`[test-channel] API Token length: ${apiToken.length}`);
    // SECURITY: Mask token in logs (show only first 6 and last 4 chars)
    const maskedToken = apiToken.length > 10 
      ? `${apiToken.substring(0, 6)}...${apiToken.substring(apiToken.length - 4)}`
      : '***';
    console.log(`[test-channel] API Token (masked): ${maskedToken}`);
    console.log(`[test-channel] Subscription ID: ${subscriptionId}`);

    // RELAXED VALIDATION: Just check non-empty (no JWT format required)
    if (!apiToken || apiToken.length < 10) {
      console.log(`[test-channel] Token too short or empty`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Token inválido. Cole o Token da API da sua conta NotificaMe. Tamanho recebido: ${apiToken.length} chars`,
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

    // Test endpoint: POST /v1/channels/whatsapp/messages with empty payload
    // Expected: 401/403 = bad token, 400/422 = token OK (payload rejected)
    const testEndpoint = `${NOTIFICAME_API_BASE_URL}/channels/whatsapp/messages`;

    console.log(`[test-channel] >>> POST ${testEndpoint}`);
    console.log(`[test-channel] >>> Header: X-API-Token: ${maskedToken}`);

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
    // SECURITY: Mask any tokens that might appear in error response
    const sanitizedProviderMessage = String(providerMessage)
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT_MASKED]')
      .substring(0, 300);
    console.log(`[test-channel] Response body: ${sanitizedProviderMessage}`);

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
