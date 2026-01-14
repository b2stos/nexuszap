/**
 * campaign-start Edge Function
 * 
 * Handles campaign start with proper contact upsert to mt_contacts:
 * 1. Validates campaign exists and is not already running
 * 2. **NEW: Validates channel connection and token BEFORE enqueuing**
 * 3. Upserts contacts to mt_contacts (resolves FK mismatch)
 * 4. Inserts campaign_recipients with valid contact_ids
 * 5. Updates mt_campaigns status to 'running'
 * 6. Returns { success: true, enqueued: N } or detailed error
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TRACE ID & STANDARDIZED RESPONSE HELPERS
// ============================================

function generateTraceId(): string {
  return crypto.randomUUID();
}

interface StandardResponse {
  ok: boolean;
  traceId: string;
  success?: boolean; // Legacy compatibility
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  // Legacy fields for compatibility
  campaign_id?: string;
  enqueued?: number;
}

function createSuccessResponse(traceId: string, data: Record<string, unknown>, status = 200): Response {
  const body: StandardResponse = {
    ok: true,
    success: true, // Legacy
    traceId,
    ...data,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-trace-id': traceId },
  });
}

function createErrorResponse(
  traceId: string,
  code: string,
  message: string,
  status: number,
  details?: unknown,
  extraFields: Record<string, unknown> = {}
): Response {
  const body: StandardResponse = {
    ok: false,
    success: false, // Legacy
    traceId,
    error: { code, message, details },
    ...extraFields,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-trace-id': traceId },
  });
}

const NOTIFICAME_BASE_URL = 'https://api.notificame.com.br/v1';

interface ContactData {
  phone: string;
  name: string | null;
  email?: string | null;
}

interface RequestBody {
  campaign_id: string;
  contacts: ContactData[];
  speed?: 'slow' | 'normal' | 'fast';
}

interface ChannelConfig {
  api_key?: string;
  subscription_id?: string;
}

/**
 * Extract and sanitize token from various formats
 */
function extractToken(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let token = raw.trim();
  
  // Remove Bearer prefix
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  
  // Remove X-API-Token: prefix
  if (token.toLowerCase().startsWith('x-api-token:')) {
    token = token.slice(12).trim();
  }
  
  // Try to extract from JSON
  if (token.startsWith('{')) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.token) token = parsed.token;
      else if (parsed.api_key) token = parsed.api_key;
      else if (parsed.apiKey) token = parsed.apiKey;
    } catch { /* not JSON */ }
  }
  
  // If it's a valid length string without spaces, accept it
  if (token.length >= 20 && !token.includes(' ')) {
    return token;
  }
  
  return null;
}

/**
 * Validate channel connection by testing the NotificaMe API
 * Returns { ok: true } or { ok: false, reason: string, code: string }
 */
async function validateChannelConnection(
  channelConfig: ChannelConfig | null,
  subscriptionId: string | null
): Promise<{ ok: boolean; reason?: string; code?: string }> {
  // Check if we have a token
  const token = extractToken(channelConfig?.api_key);
  
  if (!token) {
    return { ok: false, reason: 'Token não configurado no canal', code: 'NO_TOKEN' };
  }
  
  // Check if token equals subscription_id (misconfiguration)
  if (token === subscriptionId) {
    return { 
      ok: false, 
      reason: 'Token configurado incorretamente (igual ao ID da assinatura). Verifique a API Key.', 
      code: 'TOKEN_MISCONFIGURED' 
    };
  }
  
  if (!subscriptionId) {
    return { ok: false, reason: 'Subscription ID não configurado', code: 'NO_SUBSCRIPTION' };
  }
  
  // Test the API with a more reliable endpoint - send a test with empty body
  // This will return 400 "no destinations" if auth is valid, or 401/403 if not
  try {
    console.log('[campaign-start] Testing NotificaMe connection...');
    const response = await fetch(`${NOTIFICAME_BASE_URL}/subscriptions/${subscriptionId}/send-template`, {
      method: 'POST',
      headers: {
        'X-API-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Empty body - will fail with 400 if auth works
    });
    
    console.log('[campaign-start] NotificaMe validation response:', response.status);
    
    // 401/403 = definitely invalid token
    if (response.status === 401 || response.status === 403) {
      return { 
        ok: false, 
        reason: 'Token inválido ou expirado. Reconecte o canal em Configurações → Canais.',
        code: 'TOKEN_INVALID'
      };
    }
    
    // 400 = auth worked but request was invalid (expected - we sent empty body)
    // 404 = subscription not found but auth may have worked
    // 200-299 = success (unlikely with empty body but accept it)
    if (response.status === 400 || response.status === 404 || response.ok) {
      console.log('[campaign-start] Auth validated successfully (status:', response.status, ')');
      return { ok: true };
    }
    
    // 5xx errors often indicate malformed token or server issues
    if (response.status >= 500) {
      // Check response body for more details
      let errorDetail = '';
      try {
        const body = await response.json();
        errorDetail = body?.message || body?.error || '';
        console.error('[campaign-start] Server error body:', body);
      } catch { /* ignore */ }
      
      // If it mentions auth/token, treat as invalid
      if (errorDetail.toLowerCase().includes('token') || errorDetail.toLowerCase().includes('auth')) {
        return { 
          ok: false, 
          reason: 'Token inválido ou mal-formado. Verifique a configuração do canal.',
          code: 'TOKEN_INVALID'
        };
      }
      
      console.error('[campaign-start] Server error during validation:', response.status);
      return { 
        ok: false, 
        reason: 'Erro ao validar token. Verifique se o token está correto e tente novamente.',
        code: 'TOKEN_VALIDATION_ERROR'
      };
    }
    
    // Other 4xx errors - treat as potential auth issues
    console.error('[campaign-start] Unexpected client error:', response.status);
    return { 
      ok: false, 
      reason: `Erro de autenticação (${response.status}). Verifique a configuração do canal.`,
      code: 'AUTH_ERROR'
    };
    
  } catch (error) {
    console.error('[campaign-start] Network error testing channel:', error);
    return { 
      ok: false, 
      reason: 'Erro de conexão ao validar canal. Verifique sua conexão.',
      code: 'NETWORK_ERROR'
    };
  }
}

Deno.serve(async (req) => {
  const traceId = generateTraceId();
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders, 'x-trace-id': traceId } });
  }

  console.log(`[campaign-start][${traceId}] ====== START ======`);
  
  try {
    // Get Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error(`[campaign-start][${traceId}] Invalid JSON:`, parseError);
      return createErrorResponse(traceId, 'INVALID_JSON', 'Corpo da requisição inválido', 400);
    }
    
    const { campaign_id, contacts, speed = 'normal' } = body;

    console.log(`[campaign-start][${traceId}] campaign_id:`, campaign_id);
    console.log(`[campaign-start][${traceId}] contacts count:`, contacts?.length || 0);
    console.log(`[campaign-start][${traceId}] speed:`, speed);

    // Validate required fields
    if (!campaign_id) {
      console.error(`[campaign-start][${traceId}] Missing campaign_id`);
      return createErrorResponse(traceId, 'MISSING_CAMPAIGN_ID', 'campaign_id é obrigatório', 400, undefined, { enqueued: 0 });
    }

    if (!contacts || contacts.length === 0) {
      console.error(`[campaign-start][${traceId}] No contacts provided`);
      return createErrorResponse(traceId, 'NO_CONTACTS', 'Nenhum contato fornecido', 400, undefined, { enqueued: 0 });
    }

    // 1. Fetch campaign WITH channel details for validation
    console.log(`[campaign-start][${traceId}] Fetching campaign with channel...`);
    const { data: campaign, error: campaignError } = await supabase
      .from('mt_campaigns')
      .select(`
        id, tenant_id, status, name, channel_id, template_id,
        channel:channels!inner(
          id, name, status, provider_config, provider_phone_id
        )
      `)
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error(`[campaign-start][${traceId}] Campaign not found:`, campaignError);
      return createErrorResponse(
        traceId,
        'CAMPAIGN_NOT_FOUND',
        'Campanha não encontrada',
        404,
        { db_error: campaignError?.message },
        { enqueued: 0 }
      );
    }

    console.log(`[campaign-start][${traceId}] Campaign found:`, campaign.name, 'status:', campaign.status);

    if (campaign.status === 'running') {
      console.warn(`[campaign-start][${traceId}] Campaign already running`);
      return createErrorResponse(traceId, 'ALREADY_RUNNING', 'Campanha já está em execução', 400, undefined, { enqueued: 0 });
    }

    // 2. **NEW: Validate channel connection BEFORE proceeding**
    // deno-lint-ignore no-explicit-any
    const channelData = campaign.channel as any;
    const channel = {
      id: channelData.id as string,
      name: channelData.name as string,
      status: channelData.status as string,
      provider_config: channelData.provider_config as ChannelConfig | null,
      provider_phone_id: channelData.provider_phone_id as string | null,
    };
    
    console.log(`[campaign-start][${traceId}] Channel status:`, channel.status);
    
    // Check channel status first
    if (channel.status !== 'connected') {
      console.error(`[campaign-start][${traceId}] Channel not connected:`, channel.status);
      return createErrorResponse(
        traceId,
        'CHANNEL_DISCONNECTED',
        `O canal "${channel.name}" não está conectado`,
        400,
        'Reconecte em Configurações → Canais.',
        { enqueued: 0 }
      );
    }
    
    // Validate token with NotificaMe API
    const subscriptionId = (channel.provider_config as ChannelConfig)?.subscription_id || channel.provider_phone_id;
    const validation = await validateChannelConnection(channel.provider_config, subscriptionId);
    
    if (!validation.ok) {
      console.error(`[campaign-start][${traceId}] Channel validation failed:`, validation.reason);
      return createErrorResponse(
        traceId,
        validation.code || 'CHANNEL_VALIDATION_ERROR',
        validation.reason || 'Falha ao validar canal',
        400,
        'Verifique a configuração do canal em Configurações → Canais.',
        { enqueued: 0 }
      );
    }
    
    console.log(`[campaign-start][${traceId}] Channel validation passed ✓`);

    const tenantId = campaign.tenant_id;
    console.log(`[campaign-start][${traceId}] Tenant ID:`, tenantId);

    // 2. Normalize phone numbers and prepare contacts for upsert
    console.log(`[campaign-start][${traceId}] Normalizing phones and preparing upsert...`);
    const normalizePhone = (phone: string): string => {
      // Remove all non-numeric characters
      let normalized = phone.replace(/\D/g, '');
      
      // Add Brazil country code if missing
      if (normalized.length === 11 && normalized.startsWith('9')) {
        normalized = '55' + normalized;
      } else if (normalized.length === 10 || normalized.length === 11) {
        normalized = '55' + normalized;
      }
      
      return normalized;
    };

    // Create unique contacts by phone (deduplicate)
    const contactsByPhone = new Map<string, ContactData>();
    for (const contact of contacts) {
      const normalizedPhone = normalizePhone(contact.phone);
      if (normalizedPhone && normalizedPhone.length >= 10) {
        // Keep first occurrence (or could merge data)
        if (!contactsByPhone.has(normalizedPhone)) {
          contactsByPhone.set(normalizedPhone, {
            phone: normalizedPhone,
            name: contact.name,
            email: contact.email || null,
          });
        }
      }
    }

    const uniqueContacts = Array.from(contactsByPhone.values());
    console.log(`[campaign-start][${traceId}] Unique contacts after normalization:`, uniqueContacts.length);

    if (uniqueContacts.length === 0) {
      console.error(`[campaign-start][${traceId}] No valid contacts after normalization`);
      return createErrorResponse(traceId, 'NO_VALID_PHONES', 'Nenhum número de telefone válido encontrado', 400, undefined, { enqueued: 0 });
    }

    // 3. Upsert contacts to mt_contacts (uses unique constraint on tenant_id + phone)
    console.log('[campaign-start] Upserting contacts to mt_contacts...');
    
    const contactsToUpsert = uniqueContacts.map(c => ({
      tenant_id: tenantId,
      phone: c.phone,
      name: c.name,
      email: c.email,
      is_blocked: false,
    }));

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    const upsertedContactIds: string[] = [];
    let upsertErrors: string[] = [];

    for (let i = 0; i < contactsToUpsert.length; i += BATCH_SIZE) {
      const batch = contactsToUpsert.slice(i, i + BATCH_SIZE);
      
      const { data: upsertedBatch, error: upsertError } = await supabase
        .from('mt_contacts')
        .upsert(batch, { 
          onConflict: 'tenant_id,phone',
          ignoreDuplicates: false,
        })
        .select('id, phone');

      if (upsertError) {
        console.error(`[campaign-start][${traceId}] Upsert batch error:`, upsertError);
        upsertErrors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${upsertError.message}`);
      } else if (upsertedBatch) {
        upsertedBatch.forEach(c => upsertedContactIds.push(c.id));
        console.log(`[campaign-start][${traceId}] Upserted batch ${Math.floor(i/BATCH_SIZE) + 1}: ${upsertedBatch.length} contacts`);
      }
    }

    // If we couldn't upsert any contacts, fail
    if (upsertedContactIds.length === 0) {
      console.error(`[campaign-start][${traceId}] No contacts upserted`);
      return createErrorResponse(
        traceId,
        'UPSERT_FAILED',
        'Falha ao salvar contatos no banco',
        500,
        upsertErrors.join('; '),
        { enqueued: 0 }
      );
    }

    console.log(`[campaign-start][${traceId}] Total contacts upserted:`, upsertedContactIds.length);

    // 4. Delete any existing recipients for this campaign (in case of restart)
    console.log(`[campaign-start][${traceId}] Cleaning existing recipients...`);
    const { error: deleteError } = await supabase
      .from('campaign_recipients')
      .delete()
      .eq('campaign_id', campaign_id);

    if (deleteError) {
      console.warn(`[campaign-start][${traceId}] Failed to delete existing recipients:`, deleteError);
    }

    // 5. Insert campaign_recipients with valid mt_contacts IDs
    console.log(`[campaign-start][${traceId}] Inserting campaign recipients...`);
    
    const recipientsToInsert = upsertedContactIds.map(contactId => ({
      campaign_id: campaign_id,
      contact_id: contactId,
      status: 'queued',
      variables: {},
      attempts: 0,
    }));

    let insertedCount = 0;
    let insertErrors: string[] = [];

    for (let i = 0; i < recipientsToInsert.length; i += BATCH_SIZE) {
      const batch = recipientsToInsert.slice(i, i + BATCH_SIZE);
      
      const { data: insertedBatch, error: insertError } = await supabase
        .from('campaign_recipients')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`[campaign-start][${traceId}] Insert recipients batch error:`, insertError);
        insertErrors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${insertError.message}`);
      } else if (insertedBatch) {
        insertedCount += insertedBatch.length;
        console.log(`[campaign-start][${traceId}] Inserted recipients batch ${Math.floor(i/BATCH_SIZE) + 1}: ${insertedBatch.length}`);
      }
    }

    console.log(`[campaign-start][${traceId}] Total recipients inserted:`, insertedCount);

    // If we couldn't insert any recipients, fail
    if (insertedCount === 0) {
      console.error(`[campaign-start][${traceId}] No recipients inserted`);
      return createErrorResponse(
        traceId,
        'INSERT_RECIPIENTS_FAILED',
        'Falha ao criar destinatários da campanha',
        500,
        insertErrors.join('; '),
        { enqueued: 0 }
      );
    }

    // 6. Update campaign status to running
    console.log(`[campaign-start][${traceId}] Updating campaign status to running...`);
    const { error: updateError } = await supabase
      .from('mt_campaigns')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        total_recipients: insertedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign_id);

    if (updateError) {
      console.error(`[campaign-start][${traceId}] Failed to update campaign status:`, updateError);
      return createErrorResponse(
        traceId,
        'UPDATE_STATUS_FAILED',
        'Falha ao atualizar status da campanha',
        500,
        updateError.message,
        { enqueued: insertedCount }
      );
    }

    console.log(`[campaign-start][${traceId}] Campaign status updated to running`);

    // 7. Trigger first batch processing (fire and forget)
    console.log(`[campaign-start][${traceId}] Triggering first batch processing...`);
    try {
      const processUrl = `${supabaseUrl}/functions/v1/campaign-process-queue`;
      fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ campaign_id, speed }),
      }).catch(e => console.warn(`[campaign-start][${traceId}] Process trigger failed:`, e));
    } catch (e) {
      console.warn(`[campaign-start][${traceId}] Failed to trigger processing:`, e);
    }

    // Success response
    console.log(`[campaign-start][${traceId}] ====== SUCCESS ======`);
    
    return createSuccessResponse(traceId, {
      campaign_id,
      enqueued: insertedCount,
      total_contacts_received: contacts.length,
      unique_valid_phones: uniqueContacts.length,
      upsert_errors: upsertErrors.length > 0 ? upsertErrors : undefined,
      insert_errors: insertErrors.length > 0 ? insertErrors : undefined,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[campaign-start][${traceId}] ====== UNEXPECTED ERROR ======`);
    console.error(`[campaign-start][${traceId}] Error:`, errorMessage);
    console.error(`[campaign-start][${traceId}] Stack:`, errorStack);
    
    return createErrorResponse(
      traceId,
      'INTERNAL_ERROR',
      errorMessage,
      500,
      { stack: errorStack?.substring(0, 500) },
      { enqueued: 0 }
    );
  }
});
