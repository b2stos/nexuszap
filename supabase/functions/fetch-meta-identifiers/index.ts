/**
 * fetch-meta-identifiers Edge Function
 * 
 * Busca Phone Number ID e outros identificadores do Meta (WABA)
 * via Graph API e atualiza o canal no banco de dados.
 * 
 * Estratégia:
 * - Se o canal tem access_token (Meta direto): busca via Graph API
 * - Se o canal usa NotificaMe: tenta buscar via API do NotificaMe ou retorna indisponível
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelConfig {
  waba_id?: string;
  access_token?: string;
  api_key?: string;
  subscription_id?: string;
  phone_number_id?: string;
}

interface MetaIdentifiersResponse {
  success: boolean;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  reason?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header for user validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel_id from request body
    const body = await req.json();
    const { channel_id } = body;

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'channel_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-meta-identifiers] Fetching for channel: ${channel_id}`);

    // Fetch channel with tenant validation
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, tenant_id, name, phone_number, provider_config, provider_id')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      console.error('[fetch-meta-identifiers] Channel not found:', channelError);
      return new Response(
        JSON.stringify({ success: false, error: 'Canal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user belongs to tenant
    const { data: belongsToTenant } = await supabase
      .rpc('user_belongs_to_tenant', { _user_id: user.id, _tenant_id: channel.tenant_id });

    if (!belongsToTenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para acessar este canal' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = channel.provider_config as ChannelConfig | null;
    const wabaId = config?.waba_id;
    const accessToken = config?.access_token;
    const apiKey = config?.api_key;

    // Check if we already have phone_number_id cached
    if (config?.phone_number_id) {
      console.log('[fetch-meta-identifiers] Using cached phone_number_id');
      return new Response(
        JSON.stringify({
          success: true,
          waba_id: wabaId || null,
          phone_number_id: config.phone_number_id,
          display_phone_number: channel.phone_number,
          cached: true,
        } as MetaIdentifiersResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strategy 1: Meta Graph API (if we have access_token and waba_id)
    if (wabaId && accessToken) {
      console.log('[fetch-meta-identifiers] Fetching from Meta Graph API');
      
      try {
        const graphUrl = `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`;
        const graphResponse = await fetch(graphUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!graphResponse.ok) {
          const errorText = await graphResponse.text();
          console.error('[fetch-meta-identifiers] Meta API error:', graphResponse.status, errorText);
          
          if (graphResponse.status === 401 || graphResponse.status === 403) {
            return new Response(
              JSON.stringify({
                success: true,
                waba_id: wabaId,
                phone_number_id: null,
                display_phone_number: channel.phone_number,
                reason: 'token_expired_or_no_permission',
              } as MetaIdentifiersResponse),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              waba_id: wabaId,
              phone_number_id: null,
              display_phone_number: channel.phone_number,
              reason: 'meta_api_error',
            } as MetaIdentifiersResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const graphData = await graphResponse.json();
        console.log('[fetch-meta-identifiers] Meta API response:', JSON.stringify(graphData));

        // Find the phone number that matches our channel
        const phoneNumbers = graphData.data || [];
        let matchedPhone = null;

        if (phoneNumbers.length === 1) {
          // Only one phone number, use it
          matchedPhone = phoneNumbers[0];
        } else if (channel.phone_number) {
          // Try to match by display_phone_number
          const cleanChannelPhone = channel.phone_number.replace(/\D/g, '');
          matchedPhone = phoneNumbers.find((p: any) => {
            const cleanMetaPhone = (p.display_phone_number || '').replace(/\D/g, '');
            return cleanMetaPhone.includes(cleanChannelPhone) || cleanChannelPhone.includes(cleanMetaPhone);
          });
        }

        if (!matchedPhone && phoneNumbers.length > 0) {
          // Fallback to first one
          matchedPhone = phoneNumbers[0];
        }

        if (matchedPhone) {
          const phoneNumberId = matchedPhone.id;
          const displayPhone = matchedPhone.display_phone_number;

          // Update channel with the fetched data
          const updatedConfig = {
            ...config,
            phone_number_id: phoneNumberId,
          };

          const { error: updateError } = await supabase
            .from('channels')
            .update({
              provider_config: updatedConfig,
              phone_number: displayPhone || channel.phone_number,
            })
            .eq('id', channel_id);

          if (updateError) {
            console.error('[fetch-meta-identifiers] Failed to update channel:', updateError);
          } else {
            console.log('[fetch-meta-identifiers] Channel updated with phone_number_id:', phoneNumberId);
          }

          return new Response(
            JSON.stringify({
              success: true,
              waba_id: wabaId,
              phone_number_id: phoneNumberId,
              display_phone_number: displayPhone || channel.phone_number,
            } as MetaIdentifiersResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // No phone numbers found
        return new Response(
          JSON.stringify({
            success: true,
            waba_id: wabaId,
            phone_number_id: null,
            display_phone_number: channel.phone_number,
            reason: 'no_phone_numbers_in_waba',
          } as MetaIdentifiersResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (fetchError) {
        console.error('[fetch-meta-identifiers] Fetch error:', fetchError);
        return new Response(
          JSON.stringify({
            success: true,
            waba_id: wabaId,
            phone_number_id: null,
            display_phone_number: channel.phone_number,
            reason: 'network_error',
          } as MetaIdentifiersResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Strategy 2: NotificaMe provider (api_key only, no direct Meta access)
    if (apiKey && !accessToken) {
      console.log('[fetch-meta-identifiers] NotificaMe provider - cannot fetch phone_number_id directly');
      
      // NotificaMe doesn't expose phone_number_id via their API
      // Return the waba_id if available, but no phone_number_id
      return new Response(
        JSON.stringify({
          success: true,
          waba_id: wabaId || null,
          phone_number_id: null,
          display_phone_number: channel.phone_number,
          reason: 'provider_does_not_expose',
        } as MetaIdentifiersResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No credentials configured
    return new Response(
      JSON.stringify({
        success: true,
        waba_id: wabaId || null,
        phone_number_id: null,
        display_phone_number: channel.phone_number,
        reason: 'no_credentials_configured',
      } as MetaIdentifiersResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-meta-identifiers] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
