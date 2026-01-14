/**
 * Edge Function: list-notificame-templates
 * 
 * Lista templates aprovados do NotificaMe para importação
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificameRequest, resolveToken, maskToken, extractToken } from '../_shared/notificameClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificaMeTemplate {
  id?: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

interface TemplateListResponse {
  data?: NotificaMeTemplate[];
  templates?: NotificaMeTemplate[];
  message_templates?: NotificaMeTemplate[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel_id from request
    const body = await req.json().catch(() => ({}));
    const { channel_id } = body;

    if (!channel_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'channel_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel config
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, tenant_id, provider_config, provider_id')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      console.error('[list-notificame-templates] Channel not found:', channelError);
      return new Response(
        JSON.stringify({ success: false, error: 'Canal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', channel.tenant_id)
      .eq('is_active', true)
      .single();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para este canal' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get token from channel config
    const providerConfig = channel.provider_config as { api_key?: string; subscription_id?: string } | null;
    const token = resolveToken(providerConfig);

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token do NotificaMe não configurado neste canal. Configure em Canais → Editar.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list-notificame-templates] Fetching templates with token: ${maskToken(token)}`);

    // Try multiple endpoints to get templates
    const endpoints = [
      '/templates',
      '/message-templates',
      '/whatsapp/templates',
      '/channels/whatsapp/templates',
    ];

    let templates: NotificaMeTemplate[] = [];
    let lastError: string | null = null;

    for (const endpoint of endpoints) {
      console.log(`[list-notificame-templates] Trying endpoint: ${endpoint}`);
      
      const result = await notificameRequest<TemplateListResponse | NotificaMeTemplate[]>(
        'GET',
        endpoint,
        token
      );

      if (result.success && result.data) {
        const data = result.data;
        
        // Handle different response formats
        if (Array.isArray(data)) {
          templates = data;
        } else if (data.data) {
          templates = data.data;
        } else if (data.templates) {
          templates = data.templates;
        } else if (data.message_templates) {
          templates = data.message_templates;
        }

        if (templates.length > 0) {
          console.log(`[list-notificame-templates] Found ${templates.length} templates at ${endpoint}`);
          break;
        }
      } else {
        lastError = result.error?.message || 'Erro desconhecido';
        console.log(`[list-notificame-templates] Endpoint ${endpoint} failed: ${lastError}`);
      }
    }

    // If no templates found but no auth error, it might be empty
    if (templates.length === 0 && lastError) {
      // Check if it's an auth error
      if (lastError.includes('Token') || lastError.includes('401') || lastError.includes('403')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Não foi possível autenticar com o NotificaMe. Verifique o token do canal.',
            templates: []
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Transform templates to our format
    const transformedTemplates = templates.map((t) => ({
      external_id: t.id || t.name,
      name: t.name,
      language: t.language || 'pt_BR',
      category: (t.category || 'UTILITY').toUpperCase(),
      status: (t.status || 'approved').toLowerCase(),
      components: t.components || [],
    }));

    console.log(`[list-notificame-templates] Returning ${transformedTemplates.length} templates`);

    return new Response(
      JSON.stringify({
        success: true,
        templates: transformedTemplates,
        message: transformedTemplates.length > 0 
          ? `Encontrados ${transformedTemplates.length} template(s)`
          : 'Nenhum template encontrado no provedor',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[list-notificame-templates] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
        templates: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
