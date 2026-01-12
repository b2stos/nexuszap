/**
 * Edge Function: notificame-health-check
 * 
 * Retorna status de saúde da integração NotificaMe para diagnóstico.
 * Apenas para Super Admins.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Check configurations
    const apiToken = Deno.env.get('NOTIFICAME_X_API_TOKEN') || '';
    const apiBaseUrl = Deno.env.get('NOTIFICAME_API_BASE_URL') || 'https://api.notificame.com.br/v1';

    // Get recent errors from mt_webhook_events
    const { data: recentErrors } = await adminSupabase
      .from('mt_webhook_events')
      .select('id, event_type, processing_error, received_at, payload_raw')
      .or('processing_error.neq.null,is_invalid.eq.true')
      .order('received_at', { ascending: false })
      .limit(20);

    // Get channels status
    const { data: channels } = await adminSupabase
      .from('channels')
      .select('id, name, status, last_connected_at, provider_config')
      .order('created_at', { ascending: false });

    // Get recent outbound message failures
    const { data: outboundErrors } = await adminSupabase
      .from('mt_messages')
      .select('id, status, error_code, error_detail, created_at, contact_id')
      .eq('direction', 'outbound')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20);

    // Test API connectivity
    let apiConnectivity = { success: false, status: 0, message: '' };
    if (apiToken) {
      try {
        const testResponse = await fetch(`${apiBaseUrl}/channels/whatsapp/messages`, {
          method: 'POST',
          headers: {
            'X-API-Token': apiToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });
        
        // 400/422 means auth is OK but payload invalid = success
        apiConnectivity = {
          success: testResponse.status === 400 || testResponse.status === 422 || testResponse.ok,
          status: testResponse.status,
          message: testResponse.status === 400 || testResponse.status === 422 
            ? 'Token autenticado com sucesso' 
            : testResponse.status === 401 || testResponse.status === 403
              ? 'Token rejeitado pelo NotificaMe'
              : `Status: ${testResponse.status}`,
        };
      } catch (e) {
        apiConnectivity = {
          success: false,
          status: 0,
          message: `Erro de rede: ${e instanceof Error ? e.message : 'Unknown'}`,
        };
      }
    }

    // Format channel info (hide sensitive data)
    const channelsInfo = channels?.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      last_connected_at: c.last_connected_at,
      has_subscription_id: !!(c.provider_config as Record<string, unknown>)?.subscription_id,
    }));

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
          api_token_configured: !!apiToken,
          api_token_length: apiToken.length,
          api_base_url: apiBaseUrl,
        },
        api_connectivity: apiConnectivity,
        channels: channelsInfo,
        recent_webhook_errors: errorsInfo,
        recent_outbound_errors: outboundErrorsInfo,
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
