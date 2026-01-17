/**
 * Edge Function: revalidate-template-status
 * 
 * Revalida o status de um template na Meta API e atualiza no banco de dados.
 * Usado como "gate" antes de criar/disparar campanhas para garantir que
 * o template está APPROVED na fonte de verdade (Meta).
 * 
 * REQUEST:
 * {
 *   template_id: string (ID do mt_templates),
 *   campaign_id?: string (opcional, para logging)
 * }
 * 
 * RESPONSE:
 * {
 *   ok: boolean,
 *   template_id: string,
 *   status: string (normalized status),
 *   meta_status: string (original Meta status),
 *   verified_at: string (ISO timestamp),
 *   can_use: boolean (true if approved),
 *   mismatch: boolean (true if local != meta),
 *   error?: { code, message, details }
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
}

interface MetaTemplate {
  id?: string;
  name: string;
  language?: string;
  category?: string;
  status?: string;
  components?: TemplateComponent[];
}

/**
 * Normaliza o status do template da Meta para formato canônico
 */
function normalizeMetaStatus(metaStatus: string | null | undefined): string {
  if (!metaStatus) return 'unknown';
  
  const normalized = metaStatus.toUpperCase().trim();
  
  const statusMap: Record<string, string> = {
    'PENDING': 'pending',
    'APPROVED': 'approved',
    'ACTIVE': 'approved',
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
 * Map normalized status to DB enum (approved | pending | rejected)
 */
function mapToDbEnum(normalizedStatus: string): 'approved' | 'pending' | 'rejected' {
  if (normalizedStatus === 'approved') return 'approved';
  if (normalizedStatus === 'rejected') return 'rejected';
  return 'pending'; // pending, paused, disabled, in_appeal, flagged, unknown
}

/**
 * Check if template can be used for campaigns
 */
function canUseTemplate(status: string): boolean {
  return status === 'approved';
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  console.log(`[revalidate-template][${requestId}] Request started`);
  
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
          error: { code: 'UNAUTHORIZED', message: 'Não autenticado' }
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
          error: { code: 'INVALID_TOKEN', message: 'Token inválido' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const body = await req.json().catch(() => ({}));
    const { template_id, campaign_id } = body;

    if (!template_id) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: { code: 'MISSING_TEMPLATE_ID', message: 'template_id é obrigatório' }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[revalidate-template][${requestId}] Template ID: ${template_id}, Campaign ID: ${campaign_id || 'N/A'}`);

    // 1. Get template with channel info
    const { data: template, error: templateError } = await supabase
      .from('mt_templates')
      .select(`
        id, name, language, status, tenant_id, provider_id,
        provider_template_id, meta_template_id, last_synced_at
      `)
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      console.error(`[revalidate-template][${requestId}] Template not found:`, templateError);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template não encontrado' }
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const localStatus = template.status;
    console.log(`[revalidate-template][${requestId}] Local status: ${localStatus}`);

    // 2. Verify user belongs to tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', template.tenant_id)
      .eq('is_active', true)
      .single();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: { code: 'FORBIDDEN', message: 'Sem permissão para este template' }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get channel config for Meta credentials
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('id, provider_config')
      .eq('tenant_id', template.tenant_id)
      .eq('provider_id', template.provider_id)
      .eq('status', 'connected')
      .limit(1);

    if (channelError || !channels || channels.length === 0) {
      console.warn(`[revalidate-template][${requestId}] No connected channel found`);
      // Return current local status without revalidation
      return new Response(
        JSON.stringify({ 
          ok: true, 
          template_id,
          status: localStatus,
          meta_status: null,
          verified_at: new Date().toISOString(),
          can_use: canUseTemplate(localStatus),
          mismatch: false,
          warning: 'Nenhum canal conectado para revalidar na Meta. Usando status local.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const channel = channels[0];
    const providerConfig = channel.provider_config as { 
      waba_id?: string;
      access_token?: string;
    } | null;

    const wabaId = providerConfig?.waba_id;
    const accessToken = providerConfig?.access_token;

    // 4. Check if we have Meta credentials
    if (!wabaId || !accessToken) {
      console.warn(`[revalidate-template][${requestId}] No Meta credentials`);
      return new Response(
        JSON.stringify({ 
          ok: true, 
          template_id,
          status: localStatus,
          meta_status: null,
          verified_at: new Date().toISOString(),
          can_use: canUseTemplate(localStatus),
          mismatch: false,
          warning: 'Credenciais Meta não configuradas. Usando status local.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Fetch template status from Meta API
    console.log(`[revalidate-template][${requestId}] Fetching from Meta API...`);
    
    // Fetch all templates and find by name + language
    const metaUrl = `${META_GRAPH_API_URL}/${wabaId}/message_templates?name=${encodeURIComponent(template.name)}&limit=100`;
    
    let metaStatus: string | null = null;
    let metaTemplate: MetaTemplate | null = null;
    
    try {
      const response = await fetch(metaUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as {
        data?: MetaTemplate[];
        error?: { code: number; message: string };
      };

      if (data.error) {
        console.error(`[revalidate-template][${requestId}] Meta API error:`, data.error);
        
        // Handle token errors
        if (data.error.code === 190 || data.error.code === 102) {
          return new Response(
            JSON.stringify({ 
              ok: false, 
              template_id,
              status: localStatus,
              error: { 
                code: 'META_TOKEN_INVALID', 
                message: 'Access Token da Meta inválido ou expirado',
                details: 'Atualize o token nas configurações do canal.'
              }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(data.error.message);
      }

      // Find matching template by name and language
      const templates = data.data || [];
      metaTemplate = templates.find(t => 
        t.name === template.name && 
        (t.language === template.language || !template.language)
      ) || templates.find(t => t.name === template.name) || null;

      if (metaTemplate) {
        metaStatus = metaTemplate.status || null;
        console.log(`[revalidate-template][${requestId}] Meta status: ${metaStatus}`);
      } else {
        console.warn(`[revalidate-template][${requestId}] Template not found in Meta`);
        metaStatus = 'DELETED';
      }

    } catch (fetchError) {
      console.error(`[revalidate-template][${requestId}] Fetch error:`, fetchError);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          template_id,
          status: localStatus,
          error: { 
            code: 'META_FETCH_ERROR', 
            message: 'Erro ao consultar Meta API',
            details: fetchError instanceof Error ? fetchError.message : 'Verifique sua conexão.'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Compare and update if needed
    const normalizedMetaStatus = normalizeMetaStatus(metaStatus);
    const dbStatus = mapToDbEnum(normalizedMetaStatus);
    const mismatch = localStatus !== dbStatus;
    const verifiedAt = new Date().toISOString();

    console.log(`[revalidate-template][${requestId}] Local: ${localStatus}, Meta: ${metaStatus}, Normalized: ${normalizedMetaStatus}, DB: ${dbStatus}, Mismatch: ${mismatch}`);

    // 7. Update template status if there's a mismatch
    if (mismatch) {
      console.log(`[revalidate-template][${requestId}] Updating template status: ${localStatus} -> ${dbStatus}`);
      
      const { error: updateError } = await supabase
        .from('mt_templates')
        .update({ 
          status: dbStatus,
          last_synced_at: verifiedAt,
        })
        .eq('id', template_id);

      if (updateError) {
        console.error(`[revalidate-template][${requestId}] Update error:`, updateError);
      } else {
        console.log(`[revalidate-template][${requestId}] Status updated successfully`);
        
        // Log the mismatch event for observability
        console.log(`[revalidate-template][${requestId}] STATUS_MISMATCH: template_id=${template_id}, local=${localStatus}, meta=${metaStatus}, new=${dbStatus}, campaign_id=${campaign_id || 'N/A'}`);
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[revalidate-template][${requestId}] Completed in ${durationMs}ms`);

    // 8. Return result
    return new Response(
      JSON.stringify({ 
        ok: true,
        template_id,
        template_name: template.name,
        status: dbStatus,
        meta_status: metaStatus,
        normalized_status: normalizedMetaStatus,
        verified_at: verifiedAt,
        can_use: canUseTemplate(dbStatus),
        mismatch,
        previous_status: mismatch ? localStatus : undefined,
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[revalidate-template][${requestId}] Unexpected error:`, errorMessage);
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: { code: 'INTERNAL_ERROR', message: errorMessage }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
