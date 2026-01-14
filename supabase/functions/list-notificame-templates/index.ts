/**
 * Edge Function: list-notificame-templates
 * 
 * Lista templates aprovados do WhatsApp Business.
 * 
 * ESTRATÉGIA DE BUSCA:
 * 1. Primeiro tenta via API do NotificaMe (BSP) - usa token do canal
 * 2. Se o canal tem access_token da Meta configurado, tenta API da Meta diretamente
 * 
 * NotificaMe como BSP gerencia os templates, então a maioria dos clientes
 * obterá templates via API do NotificaMe, não diretamente da Meta.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificameRequest, resolveToken, maskToken } from '../_shared/notificameClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Meta Graph API configuration
const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface NotificaMeTemplate {
  id?: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  components?: TemplateComponent[];
}

interface TemplateListResponse {
  data?: NotificaMeTemplate[];
  templates?: NotificaMeTemplate[];
  message_templates?: NotificaMeTemplate[];
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
function generateVariablesSchema(components: TemplateComponent[]): Record<string, Array<{ index: number; key: string; label: string; required: boolean }>> {
  const schema: Record<string, Array<{ index: number; key: string; label: string; required: boolean }>> = {
    header: [],
    body: [],
    button: [],
  };

  for (const component of components) {
    const type = component.type?.toLowerCase() || '';
    
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

/**
 * Busca templates via API do NotificaMe (BSP)
 */
async function fetchTemplatesFromNotificaMe(token: string): Promise<{ success: boolean; templates: NotificaMeTemplate[]; error?: string }> {
  console.log('[list-templates] Trying NotificaMe API...');
  
  // Try multiple NotificaMe endpoints
  const endpoints = [
    '/templates',
    '/message-templates',
    '/whatsapp/templates',
    '/channels/whatsapp/templates',
  ];

  for (const endpoint of endpoints) {
    console.log(`[list-templates] Trying NotificaMe endpoint: ${endpoint}`);
    
    const result = await notificameRequest<TemplateListResponse | NotificaMeTemplate[]>(
      'GET',
      endpoint,
      token
    );

    if (result.success && result.data) {
      let templates: NotificaMeTemplate[] = [];
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
        console.log(`[list-templates] Found ${templates.length} templates at NotificaMe ${endpoint}`);
        return { success: true, templates };
      }
    } else {
      console.log(`[list-templates] NotificaMe ${endpoint} failed: ${result.error?.message || 'Unknown'}`);
    }
  }

  return { success: false, templates: [], error: 'Nenhum template encontrado via NotificaMe API' };
}

/**
 * Busca templates via API da Meta (requer access_token específico)
 */
async function fetchTemplatesFromMeta(wabaId: string, accessToken: string): Promise<{ success: boolean; templates: NotificaMeTemplate[]; error?: string }> {
  console.log(`[list-templates] Trying Meta API for WABA: ${wabaId}`);
  
  const metaUrl = `${META_GRAPH_API_URL}/${wabaId}/message_templates?status=APPROVED&limit=100`;
  
  try {
    const response = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.error) {
      console.error('[list-templates] Meta API error:', data.error);
      
      let errorMessage = 'Erro ao buscar templates da Meta';
      if (data.error.code === 190 || data.error.code === 102) {
        errorMessage = 'Access Token da Meta inválido ou expirado. Configure um token válido nas configurações do canal.';
      } else if (data.error.code === 100) {
        errorMessage = 'WABA_ID inválido. Verifique o ID da conta WhatsApp Business.';
      } else if (data.error.message) {
        errorMessage = data.error.message;
      }
      
      return { success: false, templates: [], error: errorMessage };
    }

    const templates = data.data || [];
    console.log(`[list-templates] Found ${templates.length} templates from Meta API`);
    
    // Transform Meta format to our format
    return { 
      success: true, 
      templates: templates.map((t: { id: string; name: string; language: string; category: string; status: string; components?: TemplateComponent[] }) => ({
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status?.toLowerCase(),
        components: t.components || [],
      }))
    };
  } catch (error) {
    console.error('[list-templates] Meta API fetch error:', error);
    return { success: false, templates: [], error: 'Erro de conexão com a API da Meta' };
  }
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

    // Extract config
    const providerConfig = channel.provider_config as { 
      api_key?: string; 
      subscription_id?: string;
      waba_id?: string;
      access_token?: string;
    } | null;

    const notificameToken = resolveToken(providerConfig);
    const wabaId = providerConfig?.waba_id;
    const metaAccessToken = providerConfig?.access_token;

    if (!notificameToken && !metaAccessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token do NotificaMe ou Access Token da Meta não configurado. Configure em Canais → Editar.',
          templates: []
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let templates: NotificaMeTemplate[] = [];
    let fetchError: string | undefined;
    let source = 'none';

    // Strategy 1: Try NotificaMe API first (most common for BSP users)
    if (notificameToken) {
      console.log(`[list-templates] Attempting NotificaMe API with token: ${maskToken(notificameToken)}`);
      const notificameResult = await fetchTemplatesFromNotificaMe(notificameToken);
      
      if (notificameResult.success && notificameResult.templates.length > 0) {
        templates = notificameResult.templates;
        source = 'notificame';
      } else {
        fetchError = notificameResult.error;
      }
    }

    // Strategy 2: If NotificaMe didn't return templates and we have Meta credentials, try Meta API
    if (templates.length === 0 && wabaId && metaAccessToken) {
      console.log(`[list-templates] Attempting Meta API for WABA: ${wabaId}`);
      const metaResult = await fetchTemplatesFromMeta(wabaId, metaAccessToken);
      
      if (metaResult.success && metaResult.templates.length > 0) {
        templates = metaResult.templates;
        source = 'meta';
        fetchError = undefined;
      } else if (!fetchError) {
        fetchError = metaResult.error;
      }
    }

    // Filter only approved templates
    const approvedTemplates = templates.filter(t => 
      !t.status || t.status.toLowerCase() === 'approved'
    );

    console.log(`[list-templates] Returning ${approvedTemplates.length} approved templates from ${source}`);

    // Transform templates to our format with auto-extracted variables
    const transformedTemplates = approvedTemplates.map((t) => ({
      external_id: t.id || t.name,
      name: t.name,
      language: t.language || 'pt_BR',
      category: (t.category || 'UTILITY').toUpperCase(),
      status: (t.status || 'approved').toLowerCase(),
      components: t.components || [],
      variables_schema: generateVariablesSchema(t.components || []),
    }));

    // Build response message
    let message = '';
    if (transformedTemplates.length > 0) {
      message = `Encontrados ${transformedTemplates.length} template(s) aprovados via ${source === 'meta' ? 'API da Meta' : 'NotificaMe'}`;
    } else if (fetchError) {
      message = fetchError;
    } else {
      message = 'Nenhum template aprovado encontrado. Verifique se existem templates com status APPROVED.';
    }

    return new Response(
      JSON.stringify({
        success: transformedTemplates.length > 0 || !fetchError,
        templates: transformedTemplates,
        message,
        source,
        ...(wabaId && { waba_id: wabaId }),
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
