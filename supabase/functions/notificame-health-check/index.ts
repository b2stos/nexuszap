/**
 * Edge Function: notificame-health-check
 * 
 * Retorna status de saúde da integração NotificaMe para diagnóstico.
 * Apenas para Super Admins.
 * 
 * NOTA: Tokens são configurados por canal, não globalmente.
 * 
 * MELHORIAS:
 * - Exibe URL final montada no teste de conectividade
 * - Filtra erros apenas das últimas 24h
 * - Mostra primeiros 500 chars da resposta
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API Base URL - Single Source of Truth
const API_BASE_URL = 'https://api.notificame.com.br/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Acesso restrito a administradores' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Calculate 24h ago for filtering
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get recent errors from mt_webhook_events (last 24h only)
    const { data: recentErrors } = await adminSupabase
      .from('mt_webhook_events')
      .select('id, event_type, processing_error, received_at, payload_raw')
      .or('processing_error.neq.null,is_invalid.eq.true')
      .gte('received_at', twentyFourHoursAgo)
      .order('received_at', { ascending: false })
      .limit(20);

    // Get channels status
    const { data: channels } = await adminSupabase
      .from('channels')
      .select('id, name, status, last_connected_at, provider_config')
      .order('created_at', { ascending: false });

    // Get recent outbound message failures (last 24h only)
    const { data: outboundErrors } = await adminSupabase
      .from('mt_messages')
      .select('id, status, error_code, error_detail, created_at, contact_id')
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Test API connectivity using first channel with token
    let apiConnectivity = { 
      success: false, 
      status: 0, 
      message: 'Nenhum canal com token configurado',
      url_called: '',
      response_preview: '',
    };
    
    const channelWithToken = channels?.find(c => {
      const config = c.provider_config as Record<string, unknown> | null;
      return config?.api_key && config?.subscription_id;
    });
    
    if (channelWithToken) {
      const config = channelWithToken.provider_config as Record<string, unknown>;
      const apiToken = config.api_key as string;
      const subscriptionId = config.subscription_id as string;
      
      // Use the SAME endpoint as inbox-send-text (POST /channels/whatsapp/messages)
      const testUrl = `${API_BASE_URL}/channels/whatsapp/messages`;
      
      try {
        const testPayload = {
          from: subscriptionId,
          to: '5511999999999', // Dummy number for validation test
          contents: [{ type: 'text', text: 'test' }],
        };
        
        const testResponse = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'X-API-Token': apiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testPayload),
        });
        
        const responseText = await testResponse.text();
        const responsePreview = responseText.substring(0, 500);
        
        // Interpret response:
        // 400/422 = auth OK (payload validation error)
        // 401/403 = token invalid
        // 200/201 = success (unlikely with dummy number)
        // 404 with validation = auth OK
        let isAuthOk = false;
        let message = '';
        
        if (testResponse.status === 401 || testResponse.status === 403) {
          message = 'Token rejeitado pelo NotificaMe. Verifique as credenciais do canal.';
        } else if (testResponse.status === 400 || testResponse.status === 422) {
          isAuthOk = true;
          message = 'Token autenticado com sucesso! (Payload inválido para teste = auth OK)';
        } else if (testResponse.status === 404) {
          // 404 might be endpoint not found OR validation error
          try {
            const jsonResp = JSON.parse(responseText);
            if (jsonResp.code?.includes('VALIDATION') || jsonResp.message?.includes('required')) {
              isAuthOk = true;
              message = 'Token autenticado com sucesso! (404 com erro de validação = auth OK)';
            } else {
              message = `Endpoint não encontrado ou recurso inexistente (HTTP 404)`;
            }
          } catch {
            message = `HTTP 404 - Verifique a URL: ${testUrl}`;
          }
        } else if (testResponse.ok) {
          isAuthOk = true;
          message = 'Token autenticado com sucesso!';
        } else if (testResponse.status >= 500) {
          message = `Erro no servidor NotificaMe (HTTP ${testResponse.status})`;
        } else {
          message = `Status inesperado: HTTP ${testResponse.status}`;
        }
        
        apiConnectivity = {
          success: isAuthOk,
          status: testResponse.status,
          message,
          url_called: testUrl,
          response_preview: responsePreview,
        };
      } catch (e) {
        apiConnectivity = {
          success: false,
          status: 0,
          message: `Erro de rede: ${e instanceof Error ? e.message : 'Unknown'}`,
          url_called: testUrl,
          response_preview: '',
        };
      }
    }

    // Format channel info (hide sensitive data)
    const channelsInfo = channels?.map(c => {
      const config = c.provider_config as Record<string, unknown> | null;
      const hasToken = !!config?.api_key;
      const hasSubscription = !!config?.subscription_id;
      const tokenPreview = hasToken 
        ? `***${String(config?.api_key || '').slice(-4)}`
        : null;
      
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        last_connected_at: c.last_connected_at,
        has_subscription_id: hasSubscription,
        has_token: hasToken,
        token_preview: tokenPreview,
      };
    });

    // Format errors (sanitize)
    const errorsInfo = recentErrors?.map(e => ({
      id: e.id,
      event_type: e.event_type,
      error: e.processing_error,
      received_at: e.received_at,
    }));

    const outboundErrorsInfo = outboundErrors?.map(e => ({
      id: e.id.substring(0, 8),
      error_code: e.error_code,
      error_detail: e.error_detail?.substring(0, 100),
      created_at: e.created_at,
    }));

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        configuration: {
          api_base_url: API_BASE_URL,
          channels_with_token: channelsInfo?.filter(c => c.has_token).length || 0,
          total_channels: channelsInfo?.length || 0,
        },
        api_connectivity: apiConnectivity,
        channels: channelsInfo,
        recent_webhook_errors: errorsInfo,
        recent_outbound_errors: outboundErrorsInfo,
        filters: {
          errors_since: twentyFourHoursAgo,
          note: 'Mostrando apenas erros das últimas 24 horas',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[health-check] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});