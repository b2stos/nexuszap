/**
 * Edge Function: list-notificame-templates
 * 
 * Lista templates aprovados do WhatsApp Business.
 * 
 * ESTRATÉGIA DE BUSCA:
 * 1. Primeiro tenta via API do NotificaMe (BSP) - usa token do canal
 * 2. Se o canal tem access_token da Meta configurado, tenta API da Meta diretamente
 * 
 * RESPONSE FORMAT:
 * {
 *   ok: boolean,
 *   templates: [...],
 *   error?: { code: string, message: string, details?: string },
 *   meta: { waba_id, phone_number_id, business_id, last_sync_at, source, request_id }
 * }
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
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

interface FetchResult {
  success: boolean;
  templates: NotificaMeTemplate[];
  error?: {
    code: string;
    message: string;
    details?: string;
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
 * 
 * IMPORTANTE: NotificaMe retorna status 200 mesmo em erro, com body { error: {...} }
 * Precisamos verificar o body para detectar erros reais.
 */
async function fetchTemplatesFromNotificaMe(
  token: string, 
  subscriptionId?: string
): Promise<FetchResult> {
  console.log('[list-templates] Trying NotificaMe API...');
  
  // Build endpoints to try - subscription-specific endpoints first
  const endpoints: string[] = [];
  
  if (subscriptionId) {
    endpoints.push(
      `/subscriptions/${subscriptionId}/templates`,
      `/subscriptions/${subscriptionId}/message-templates`,
      `/channels/${subscriptionId}/templates`,
      `/whatsapp/${subscriptionId}/templates`
    );
  }
  
  // Generic endpoints as fallback
  endpoints.push(
    '/subscriptions/templates',
    '/templates',
    '/message-templates',
    '/whatsapp/templates'
  );

  let lastError: { code: string; message: string; details?: string } | undefined;

  for (const endpoint of endpoints) {
    console.log(`[list-templates] Trying NotificaMe endpoint: ${endpoint}`);
    
    const result = await notificameRequest<TemplateListResponse | NotificaMeTemplate[]>(
      'GET',
      endpoint,
      token
    );

    // Check for HTTP-level errors
    if (!result.success) {
      const errorMsg = result.error?.message || 'Unknown error';
      console.log(`[list-templates] NotificaMe ${endpoint} failed: ${errorMsg}`);
      
      if (result.status === 401 || result.status === 403) {
        return { 
          success: false, 
          templates: [], 
          error: {
            code: 'AUTH_ERROR',
            message: 'Token NotificaMe inválido ou expirado',
            details: 'Reconecte o canal nas configurações.'
          }
        };
      }
      
      lastError = {
        code: `HTTP_${result.status || 'ERROR'}`,
        message: errorMsg,
        details: endpoint
      };
      continue;
    }

    const data = result.data;
    
    // Check for error in response body (NotificaMe returns 200 with error body)
    if (data && typeof data === 'object' && 'error' in data && (data as TemplateListResponse).error) {
      const apiError = (data as TemplateListResponse).error!;
      console.log(`[list-templates] NotificaMe ${endpoint} returned error in body: ${apiError.message}`);
      
      // Hub404 means endpoint doesn't exist - try next
      if (apiError.code === 'Hub404') {
        lastError = {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'Endpoint não suportado pelo NotificaMe',
          details: endpoint
        };
        continue;
      }
      
      // Other API errors
      lastError = {
        code: apiError.code || 'API_ERROR',
        message: apiError.message || 'Erro na API do NotificaMe',
        details: apiError.type
      };
      continue;
    }

    // Parse templates from various response formats
    let templates: NotificaMeTemplate[] = [];
    
    if (Array.isArray(data)) {
      templates = data;
    } else if (data && typeof data === 'object') {
      const responseData = data as TemplateListResponse;
      if (responseData.data) {
        templates = responseData.data;
      } else if (responseData.templates) {
        templates = responseData.templates;
      } else if (responseData.message_templates) {
        templates = responseData.message_templates;
      }
    }

    if (templates.length > 0) {
      console.log(`[list-templates] Found ${templates.length} templates at NotificaMe ${endpoint}`);
      return { success: true, templates };
    }
  }

  // No templates found via NotificaMe - this is NOT an error, just empty
  // But if we had API errors, report them
  if (lastError && lastError.code !== 'ENDPOINT_NOT_FOUND') {
    return { 
      success: false, 
      templates: [], 
      error: lastError
    };
  }

  // NotificaMe doesn't have templates endpoint exposed
  return { 
    success: false, 
    templates: [], 
    error: {
      code: 'NO_TEMPLATE_ENDPOINT',
      message: 'API do NotificaMe não suporta listagem de templates',
      details: 'Configure o Access Token da Meta para buscar diretamente.'
    }
  };
}

/**
 * Busca templates via API da Meta (requer access_token específico)
 */
async function fetchTemplatesFromMeta(wabaId: string, accessToken: string): Promise<FetchResult> {
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
      console.error('[list-templates] Meta API error:', JSON.stringify(data.error));
      
      let errorCode = 'META_API_ERROR';
      let errorMessage = 'Erro ao buscar templates da Meta';
      let details: string | undefined;
      
      if (data.error.code === 190 || data.error.code === 102) {
        errorCode = 'TOKEN_INVALID';
        errorMessage = 'Access Token da Meta inválido ou expirado';
        details = 'Configure um token válido nas configurações do canal.';
      } else if (data.error.code === 100) {
        errorCode = 'INVALID_WABA';
        errorMessage = 'WABA ID inválido ou sem permissão';
        details = 'Verifique se o WABA ID está correto e se o token tem acesso a esta conta.';
      } else if (data.error.code === 4) {
        errorCode = 'RATE_LIMIT';
        errorMessage = 'Limite de requisições atingido';
        details = 'Aguarde alguns minutos e tente novamente.';
      } else if (data.error.message) {
        details = data.error.message;
      }
      
      return { 
        success: false, 
        templates: [], 
        error: { code: errorCode, message: errorMessage, details }
      };
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
    return { 
      success: false, 
      templates: [], 
      error: {
        code: 'NETWORK_ERROR',
        message: 'Erro de conexão com a API da Meta',
        details: error instanceof Error ? error.message : 'Verifique sua conexão.'
      }
    };
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[list-templates][${requestId}] Request started`);
  
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
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
          meta: { request_id: requestId }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { code: 'INVALID_TOKEN', message: 'Token inválido' },
          meta: { request_id: requestId }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel_id from request
    const body = await req.json().catch(() => ({}));
    const { channel_id } = body;

    if (!channel_id) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { code: 'MISSING_CHANNEL', message: 'channel_id é obrigatório' },
          meta: { request_id: requestId }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[list-templates][${requestId}] Channel: ${channel_id}`);

    // Get channel config
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, tenant_id, provider_config, provider_id, phone_number')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
      console.error(`[list-templates][${requestId}] Channel not found:`, channelError);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { code: 'CHANNEL_NOT_FOUND', message: 'Canal não encontrado' },
          meta: { request_id: requestId, channel_id }
        }),
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
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { code: 'FORBIDDEN', message: 'Sem permissão para este canal' },
          meta: { request_id: requestId, channel_id }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract config
    const providerConfig = channel.provider_config as { 
      api_key?: string; 
      subscription_id?: string;
      waba_id?: string;
      access_token?: string;
      phone_number_id?: string;
      business_id?: string;
    } | null;

    const notificameToken = resolveToken(providerConfig);
    const wabaId = providerConfig?.waba_id;
    const metaAccessToken = providerConfig?.access_token;
    const phoneNumberId = providerConfig?.phone_number_id;
    const businessId = providerConfig?.business_id;

    // Build meta info for response
    const metaInfo = {
      request_id: requestId,
      channel_id,
      waba_id: wabaId || null,
      phone_number_id: phoneNumberId || null,
      business_id: businessId || null,
      display_phone_number: channel.phone_number || null,
      last_sync_at: new Date().toISOString(),
      source: 'none' as string,
      provider_type: notificameToken ? 'notificame' : (metaAccessToken ? 'meta' : 'none'),
    };

    if (!notificameToken && !metaAccessToken) {
      console.log(`[list-templates][${requestId}] No credentials configured`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          templates: [],
          error: { 
            code: 'NO_CREDENTIALS', 
            message: 'Credenciais não configuradas',
            details: 'Configure o Token do NotificaMe ou Access Token da Meta nas configurações do canal.'
          },
          meta: metaInfo
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let templates: NotificaMeTemplate[] = [];
    let fetchError: { code: string; message: string; details?: string } | undefined;

    // ESTRATÉGIA ATUALIZADA:
    // 1. Se tiver credenciais Meta (wabaId + accessToken), buscar DIRETAMENTE na Meta
    // 2. Se NÃO tiver Meta mas tiver NotificaMe, informar que precisa configurar Meta
    // 3. NotificaMe NÃO suporta listagem de templates de forma confiável

    // Strategy 1: Meta API (PREFERRED - always use when available)
    if (wabaId && metaAccessToken) {
      console.log(`[list-templates][${requestId}] Using Meta API for WABA: ${wabaId}`);
      const metaResult = await fetchTemplatesFromMeta(wabaId, metaAccessToken);
      
      if (metaResult.success) {
        templates = metaResult.templates;
        metaInfo.source = 'meta';
      } else {
        fetchError = metaResult.error;
        console.log(`[list-templates][${requestId}] Meta API error: ${JSON.stringify(metaResult.error)}`);
      }
    } else if (notificameToken && !metaAccessToken) {
      // Has NotificaMe but no Meta token - inform user to configure Meta
      console.log(`[list-templates][${requestId}] NotificaMe channel without Meta token`);
      
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          templates: [],
          error: {
            code: 'META_TOKEN_REQUIRED',
            message: 'Configure o Access Token da Meta para listar templates',
            details: 'Seu provedor (NotificaMe) não suporta listagem de templates. Para buscar templates aprovados diretamente da Meta, configure o WABA ID e Access Token nas configurações do canal.'
          },
          meta: metaInfo,
          requires_meta_token: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter only approved templates
    const approvedTemplates = templates.filter(t => 
      !t.status || t.status.toLowerCase() === 'approved'
    );

    console.log(`[list-templates][${requestId}] Returning ${approvedTemplates.length} approved templates from ${metaInfo.source}`);

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

    // Determine response based on results
    if (transformedTemplates.length > 0) {
      // Success with templates
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          templates: transformedTemplates,
          meta: metaInfo,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No templates found
    if (fetchError) {
      // Real error occurred - return as error
      console.log(`[list-templates][${requestId}] Returning error: ${fetchError.code}`);
      return new Response(
        JSON.stringify({
          ok: false,
          success: false,
          templates: [],
          error: fetchError,
          meta: metaInfo,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No error, successfully queried Meta but found 0 approved templates
    if (metaInfo.source === 'meta') {
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          templates: [],
          empty: true,
          message: 'Nenhum template com status APPROVED encontrado nesta conta.',
          meta: metaInfo,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No credentials configured at all
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        templates: [],
        error: {
          code: 'NO_CREDENTIALS',
          message: 'Credenciais não configuradas',
          details: 'Configure WABA ID e Access Token da Meta nas configurações do canal.'
        },
        meta: metaInfo,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[list-templates][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Erro interno',
        },
        templates: [],
        meta: { request_id: requestId }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
