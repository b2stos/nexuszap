/**
 * Edge Function: test-channel-connection
 * 
 * Testa a conexão do canal com o NotificaMe.
 * 
 * FLUXO DE VALIDAÇÃO:
 * 1. Verifica se canal interno existe no banco
 * 2. Valida se token está configurado (aceita qualquer formato, incluindo UUID)
 * 3. Valida formato do subscription_id (deve ser UUID)
 * 4. Testa autenticação com NotificaMe
 * 5. Atualiza status para "connected" se tudo OK
 * 
 * IMPORTANTE: O token do NotificaMe PODE ser um UUID. Não rejeitar UUIDs!
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken, testConnection, maskToken, ChannelConfig, extractToken } from '../_shared/notificameClient.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: detect if a string looks like a UUID
function looksLikeUUID(value: string): boolean {
  if (!value) return false;
  const clean = value.trim();
  return UUID_REGEX.test(clean);
}

// Helper: detect if token is valid (any non-empty string >= 10 chars)
// NotificaMe tokens CAN be UUIDs - this is their official format!
function isValidToken(value: string): boolean {
  if (!value) return false;
  const clean = extractToken(value);
  return clean.length >= 10;
}

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
        JSON.stringify({ 
          success: false, 
          error: { 
            detail: 'Você não está vinculado a uma organização. Configure sua conta primeiro.',
            code: 'NO_TENANT',
          } 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ====================================================
    // CHECK A: Canal interno existe?
    // ====================================================
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, name, provider_config, status, tenant_id')
      .eq('id', channel_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (channelError || !channel) {
      console.log(`[test-channel][${requestId}] Channel not found in database`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            detail: 'Canal não encontrado no sistema. Ele pode ter sido removido ou você não tem acesso.',
            code: 'CHANNEL_NOT_FOUND_INTERNAL',
          } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] Found channel: ${channel.name}`);

    const channelConfig = channel.provider_config as ChannelConfig;
    const rawApiKey = channelConfig?.api_key || '';
    const subscriptionId = (channelConfig?.subscription_id || '').trim();

    // ====================================================
    // CHECK B: Token está configurado?
    // NotificaMe tokens CAN be UUIDs - do NOT reject UUIDs!
    // ====================================================
    if (!rawApiKey) {
      console.log(`[test-channel][${requestId}] Token not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: 'Token do NotificaMe não configurado. Edite o canal e adicione seu token.',
            code: 'MISSING_TOKEN',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = extractToken(rawApiKey);
    
    // Only check minimum length - UUID format is valid!
    if (!token || token.length < 10) {
      console.log(`[test-channel][${requestId}] Token too short: ${token.length} chars`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Token muito curto (${token.length} caracteres). O token do NotificaMe deve ter pelo menos 10 caracteres.`,
            code: 'TOKEN_TOO_SHORT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] Token resolved: ${maskToken(token)}`);

    // ====================================================
    // CHECK C: Subscription ID está configurado e é UUID válido?
    // ====================================================
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

    if (!UUID_REGEX.test(subscriptionId)) {
      console.log(`[test-channel][${requestId}] Subscription ID format invalid: ${subscriptionId.substring(0, 20)}...`);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Subscription ID inválido. Deve ser um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Valor atual: "${subscriptionId.substring(0, 20)}..."`,
            code: 'INVALID_SUBSCRIPTION_ID_FORMAT',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-channel][${requestId}] Testing connection with subscription ${subscriptionId.substring(0, 8)}...`);

    // ====================================================
    // CHECK D: Token válido com NotificaMe?
    // ====================================================
    const result = await testConnection(token);

    if (!result.success && result.error?.code === 'INVALID_TOKEN') {
      // Update channel status to error
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });
      
      await adminSupabase
        .from('channels')
        .update({ 
          status: 'error', 
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            detail: `Token rejeitado pelo NotificaMe (HTTP ${result.status}). Verifique se o token está correto e ativo.`,
            code: `TOKEN_REJECTED_${result.status}`,
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
          message: '✅ Conexão OK! Token válido e canal configurado corretamente.',
          http_status: result.status,
          details: {
            token_valid: true,
            subscription_id: `${subscriptionId.substring(0, 8)}...`,
            channel_status: 'connected',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Other errors
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          detail: result.error?.message || 'Erro ao testar conexão com NotificaMe.',
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
        error: { detail: error instanceof Error ? error.message : 'Erro interno ao testar conexão' } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
