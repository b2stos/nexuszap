/**
 * Edge Function: validate-notificame-token
 * 
 * Valida um token do NotificaMe e tenta descobrir automaticamente
 * os canais/subscriptions disponíveis.
 * 
 * IMPORTANTE: O token do NotificaMe É um UUID! Não rejeitar UUIDs.
 * 
 * Aceita: apenas o token do usuário (qualquer formato)
 * Retorna: token válido/inválido + lista de canais descobertos
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractToken, maskToken, validateAndDiscoverChannels } from '../_shared/notificameClient.ts';

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
  console.log(`[validate-token][${requestId}] Starting validation`);

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
    const { token: rawToken, channel_id } = body;

    if (!rawToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { detail: 'Token é obrigatório. Cole seu token do NotificaMe.' } 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract clean token - UUID format is valid!
    const token = extractToken(rawToken);
    
    if (!token || token.length < 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { detail: `Token inválido ou muito curto (${token.length} caracteres). Verifique se você copiou corretamente.` } 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[validate-token][${requestId}] User ${user.id} validating token ${maskToken(token)}`);

    // Validate token and discover channels
    const result = await validateAndDiscoverChannels(token);

    console.log(`[validate-token][${requestId}] Validation result: valid=${result.data?.valid}, channels=${result.data?.channels?.length || 0}`);

    // If channel_id was provided and we need to update it
    if (channel_id && result.success && result.data?.valid) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // Get user's tenant
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (tenantUser) {
        // Update channel with the token and first discovered subscription
        const firstChannel = result.data.channels[0];
        const updateData: Record<string, unknown> = {
          status: 'connected',
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Build provider_config with api_key and optionally subscription_id
        const providerConfigUpdate: Record<string, string> = {
          api_key: token,
        };

        if (firstChannel?.id) {
          providerConfigUpdate.subscription_id = firstChannel.id;
          console.log(`[validate-token][${requestId}] Auto-discovered subscription_id: ${firstChannel.id}`);
        }

        // Merge with existing config
        const { data: existingChannel } = await adminSupabase
          .from('channels')
          .select('provider_config')
          .eq('id', channel_id)
          .eq('tenant_id', tenantUser.tenant_id)
          .single();

        updateData.provider_config = {
          ...(existingChannel?.provider_config as Record<string, unknown> || {}),
          ...providerConfigUpdate,
        };

        await adminSupabase
          .from('channels')
          .update(updateData)
          .eq('id', channel_id)
          .eq('tenant_id', tenantUser.tenant_id);

        console.log(`[validate-token][${requestId}] Channel ${channel_id} updated`);
      }
    }

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          message: result.data?.message || result.error?.message || 'Erro ao validar token',
          channels: [],
          error: {
            detail: result.error?.message || 'O token foi rejeitado pelo NotificaMe.',
            code: result.error?.code,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: result.data?.valid || false,
        message: result.data?.message || 'Token válido!',
        channels: result.data?.channels || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[validate-token][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        valid: false,
        error: { detail: error instanceof Error ? error.message : 'Erro ao validar token' } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
