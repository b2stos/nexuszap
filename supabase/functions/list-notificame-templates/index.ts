/**
 * Edge Function: list-notificame-templates
 * 
 * Lista templates aprovados diretamente da API oficial da Meta (WhatsApp Business Platform).
 * 
 * IMPORTANTE:
 * - Templates pertencem à Meta, NÃO ao NotificaMe
 * - NotificaMe é apenas o BSP (Business Solution Provider) que fornece o token de acesso
 * - A chamada é feita diretamente à Graph API da Meta: GET /{WABA_ID}/message_templates
 * 
 * Fluxo:
 * 1. Busca o WABA_ID do canal (armazenado em provider_config.waba_id)
 * 2. Usa o token do BSP (NotificaMe) como credencial para a Meta
 * 3. Lista apenas templates com status APPROVED
 * 4. Extrai automaticamente nome, idioma, componentes e variáveis
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken, maskToken } from '../_shared/notificameClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Meta Graph API configuration
const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'IN_APPEAL' | 'PAUSED';
  components: MetaTemplateComponent[];
  rejected_reason?: string;
}

interface MetaTemplatesResponse {
  data: MetaTemplate[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

/**
 * Extrai variáveis ({{1}}, {{2}}, etc.) de um texto
 */
function extractVariables(text: string | undefined): number[] {
  if (!text) return [];
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
}

/**
 * Gera o schema de variáveis a partir dos componentes do template
 */
function generateVariablesSchema(components: MetaTemplateComponent[]): Record<string, Array<{ index: number; key: string; label: string; required: boolean }>> {
  const schema: Record<string, Array<{ index: number; key: string; label: string; required: boolean }>> = {
    header: [],
    body: [],
    button: [],
  };

  for (const component of components) {
    const type = component.type.toLowerCase();
    
    if (type === 'header' && component.text) {
      const vars = extractVariables(component.text);
      schema.header = vars.map(index => ({
        index,
        key: `header_${index}`,
        label: `Variável ${index}`,
        required: true,
      }));
    }
    
    if (type === 'body' && component.text) {
      const vars = extractVariables(component.text);
      schema.body = vars.map(index => ({
        index,
        key: `body_${index}`,
        label: `Variável ${index}`,
        required: true,
      }));
    }
    
    if (type === 'buttons' && component.buttons) {
      let buttonVarIndex = 1;
      for (const button of component.buttons) {
        if (button.url) {
          const vars = extractVariables(button.url);
          for (const varIndex of vars) {
            schema.button.push({
              index: buttonVarIndex++,
              key: `button_${varIndex}`,
              label: `URL Variável ${varIndex}`,
              required: true,
            });
          }
        }
      }
    }
  }

  return schema;
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
      console.error('[list-templates] Channel not found:', channelError);
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

    // Extract WABA_ID and token from channel config
    const providerConfig = channel.provider_config as { 
      api_key?: string; 
      subscription_id?: string;
      waba_id?: string;
      access_token?: string;
    } | null;

    const wabaId = providerConfig?.waba_id;
    
    if (!wabaId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WABA_ID não configurado neste canal. Configure o WhatsApp Business Account ID em Canais → Editar.',
          templates: []
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token - use NotificaMe BSP token or direct access token
    const accessToken = providerConfig?.access_token || resolveToken(providerConfig);
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token de acesso não configurado neste canal. Configure em Canais → Editar.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list-templates] Fetching templates from Meta API for WABA: ${wabaId} with token: ${maskToken(accessToken)}`);

    // Call Meta Graph API to list message templates
    // Only fetch APPROVED templates
    const metaUrl = `${META_GRAPH_API_URL}/${wabaId}/message_templates?status=APPROVED&limit=100`;
    
    const metaResponse = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await metaResponse.text();
    let metaData: MetaTemplatesResponse;

    try {
      metaData = JSON.parse(responseText);
    } catch {
      console.error('[list-templates] Invalid JSON response from Meta:', responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Resposta inválida da API da Meta',
          templates: []
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Meta API errors
    if (metaData.error) {
      console.error('[list-templates] Meta API error:', metaData.error);
      
      let errorMessage = 'Erro ao buscar templates da Meta';
      
      if (metaData.error.code === 190 || metaData.error.code === 102) {
        errorMessage = 'Token de acesso inválido ou expirado. Reconecte o canal.';
      } else if (metaData.error.code === 100) {
        errorMessage = 'WABA_ID inválido. Verifique o ID da conta WhatsApp Business.';
      } else if (metaData.error.message) {
        errorMessage = metaData.error.message;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          templates: []
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!metaResponse.ok) {
      console.error('[list-templates] Meta API HTTP error:', metaResponse.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro HTTP ${metaResponse.status} ao buscar templates`,
          templates: []
        }),
        { status: metaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const templates = metaData.data || [];
    
    console.log(`[list-templates] Found ${templates.length} approved templates from Meta API`);

    // Transform templates to our format with auto-extracted variables
    const transformedTemplates = templates.map((t) => ({
      external_id: t.id,
      name: t.name,
      language: t.language,
      category: t.category.toUpperCase(),
      status: t.status.toLowerCase(),
      components: t.components || [],
      variables_schema: generateVariablesSchema(t.components || []),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        templates: transformedTemplates,
        message: transformedTemplates.length > 0 
          ? `Encontrados ${transformedTemplates.length} template(s) aprovados`
          : 'Nenhum template aprovado encontrado na conta WhatsApp Business',
        waba_id: wabaId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[list-templates] Error:', error);
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
