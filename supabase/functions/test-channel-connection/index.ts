/**
 * Edge Function: test-channel-connection
 * 
 * Testa a conexão do canal com o NotificaMe.
 * Resolve token por tenant/canal do banco de dados.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken, testConnection, maskToken, ChannelConfig } from '../_shared/notificameClient.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[test-channel][${requestId}] Starting test`);

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Não autenticado' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Não autorizado' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { channel_id } = body;

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'channel_id é obrigatório' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] User ${user.id} testing channel ${channel_id}`);

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (tenantError || !tenantUser) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Tenant não encontrado' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel (with tenant validation)
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, name, provider_config, status, tenant_id')
      .eq('id', channel_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: { detail: 'Canal não encontrado' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve token from channel config (tenant-specific) or fallback to env
    const channelConfig = channel.provider_config as ChannelConfig;
    const token = resolveToken(channelConfig);
    
    if (!token) {
      console.log(`[test-channel][${requestId}] Token not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: 'Token NotificaMe não configurado. Configure o token no canal.',
            code: 'MISSING_TOKEN',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] Token resolved: ${maskToken(token)}`);

    // Check subscription_id
    const subscriptionId = (channelConfig?.subscription_id || '').trim();

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

    console.log(`[test-channel][${requestId}] Testing connection with subscription ${subscriptionId.substring(0, 8)}...`);

    // Test connection with resolved token
    const result = await testConnection(token);

    if (!result.success && result.error?.code === 'INVALID_TOKEN') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Credenciais rejeitadas pelo NotificaMe (HTTP ${result.status}). Verifique o token configurado no canal.`,
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
          message: '✅ Token autenticado com sucesso! Credenciais válidas.',
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
