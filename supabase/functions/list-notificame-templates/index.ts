/**
 * Edge Function: list-notificame-templates
 * 
 * Lista TODOS os templates do WhatsApp Business (não apenas APPROVED).
 * 
 * ESTRATÉGIA DE BUSCA:
 * 1. Se tiver credenciais Meta (wabaId + accessToken), buscar DIRETAMENTE na Meta
 * 2. Se NÃO tiver Meta mas tiver NotificaMe, informar que precisa configurar Meta
 * 3. NotificaMe NÃO suporta listagem de templates de forma confiável
 * 
 * RESPONSE FORMAT:
 * {
 *   ok: boolean,
 *   templates: [...],
 *   error?: { code: string, message: string, details?: string },
 *   meta: { waba_id, phone_number_id, business_id, last_sync_at, source, request_id, counts_by_status }
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveToken } from '../_shared/notificameClient.ts';

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

interface MetaTemplate {
  id?: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  quality_score?: {
    score?: string;
    date?: string;
  };
  components?: TemplateComponent[];
}

interface FetchResult {
  success: boolean;
  templates: MetaTemplate[];
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  countsByStatus?: Record<string, number>;
}

/**
 * Normaliza o status do template da Meta para formato canônico
 */
function normalizeMetaStatus(metaStatus: string | null | undefined): string {
  if (!metaStatus) return 'unknown';
  
  const normalized = metaStatus.toUpperCase().trim();
  
  const statusMap: Record<string, string> = {
    'PENDING': 'pending',      // In review
    'APPROVED': 'approved',
    'ACTIVE': 'approved',      // Legacy/fallback
    'REJECTED': 'rejected',
    'PAUSED': 'paused',
    'DISABLED': 'disabled',
    'IN_APPEAL': 'in_appeal',
    'FLAGGED': 'flagged',
    'LIMIT_EXCEEDED': 'disabled',
    'DELETED': 'disabled',
  };
  
  return statusMap[normalized] || 'unknown';
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
 * Busca TODOS os templates via API da Meta (com paginação)
 * NÃO aplica filtro de status - traz tudo
 */
async function fetchAllTemplatesFromMeta(wabaId: string, accessToken: string): Promise<FetchResult> {
  console.log(`[list-templates] Fetching ALL templates from Meta API for WABA: ${wabaId}`);
  
  const allTemplates: MetaTemplate[] = [];
  const countsByStatus: Record<string, number> = {};
  let nextUrl: string | null = `${META_GRAPH_API_URL}/${wabaId}/message_templates?limit=100`;
  
  try {
    // Paginate through all results
    while (nextUrl) {
      console.log(`[list-templates] Fetching page: ${nextUrl.substring(0, 100)}...`);
      
      const fetchResponse: Response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseData = await fetchResponse.json() as {
        data?: MetaTemplate[];
        error?: { code: number; message: string };
        paging?: { next?: string };
      };

      if (responseData.error) {
        console.error('[list-templates] Meta API error:', JSON.stringify(responseData.error));
        
        let errorCode = 'META_API_ERROR';
        let errorMessage = 'Erro ao buscar templates da Meta';
        let details: string | undefined;
        
        if (responseData.error.code === 190 || responseData.error.code === 102) {
          errorCode = 'TOKEN_INVALID';
          errorMessage = 'Access Token da Meta inválido ou expirado';
          details = 'Configure um token válido nas configurações do canal.';
        } else if (responseData.error.code === 100) {
          errorCode = 'INVALID_WABA';
          errorMessage = 'WABA ID inválido ou sem permissão';
          details = 'Verifique se o WABA ID está correto e se o token tem acesso a esta conta.';
        } else if (responseData.error.code === 4) {
          errorCode = 'RATE_LIMIT';
          errorMessage = 'Limite de requisições atingido';
          details = 'Aguarde alguns minutos e tente novamente.';
        } else if (responseData.error.message) {
          details = responseData.error.message;
        }
        
        return { 
          success: false, 
          templates: [], 
          error: { code: errorCode, message: errorMessage, details }
        };
      }

      const pageTemplates = responseData.data || [];
      
      // Count by status and add to collection
      for (const t of pageTemplates) {
        const normalizedStatus = normalizeMetaStatus(t.status);
        countsByStatus[normalizedStatus] = (countsByStatus[normalizedStatus] || 0) + 1;
        allTemplates.push(t);
      }
      
      // Check for next page
      nextUrl = responseData.paging?.next || null;
    }

    console.log(`[list-templates] Found ${allTemplates.length} total templates from Meta API`);
    console.log(`[list-templates] Status breakdown:`, JSON.stringify(countsByStatus));
    
    return { 
      success: true, 
      templates: allTemplates,
      countsByStatus,
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
  const startTime = Date.now();
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
    const metaInfo: Record<string, unknown> = {
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

    let templates: MetaTemplate[] = [];
    let fetchError: { code: string; message: string; details?: string } | undefined;
    let countsByStatus: Record<string, number> = {};

    // ESTRATÉGIA ATUALIZADA:
    // 1. Se tiver credenciais Meta (wabaId + accessToken), buscar DIRETAMENTE na Meta (TODOS OS STATUS)
    // 2. Se NÃO tiver Meta mas tiver NotificaMe, informar que precisa configurar Meta

    // Strategy 1: Meta API (PREFERRED - always use when available)
    if (wabaId && metaAccessToken) {
      console.log(`[list-templates][${requestId}] Using Meta API for WABA: ${wabaId}`);
      const metaResult = await fetchAllTemplatesFromMeta(wabaId, metaAccessToken);
      
      if (metaResult.success) {
        templates = metaResult.templates;
        countsByStatus = metaResult.countsByStatus || {};
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
            details: 'Seu provedor (NotificaMe) não suporta listagem de templates. Para buscar templates diretamente da Meta, configure o WABA ID e Access Token nas configurações do canal.'
          },
          meta: metaInfo,
          requires_meta_token: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const durationMs = Date.now() - startTime;
    metaInfo.duration_ms = durationMs;
    metaInfo.counts_by_status = countsByStatus;
    metaInfo.total_count = templates.length;

    console.log(`[list-templates][${requestId}] Returning ${templates.length} templates from ${metaInfo.source} in ${durationMs}ms`);

    // Transform ALL templates to our format (não filtrar por status!)
    const transformedTemplates = templates.map((t) => ({
      external_id: t.id || t.name,
      name: t.name,
      language: t.language || 'pt_BR',
      category: (t.category || 'UTILITY').toUpperCase(),
      status: normalizeMetaStatus(t.status),
      quality_score: t.quality_score?.score || null,
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

    // No error, successfully queried Meta but found 0 templates
    if (metaInfo.source === 'meta') {
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          templates: [],
          empty: true,
          message: 'Nenhum template encontrado nesta conta.',
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
