/**
 * Campaign Process Queue - PRODUCTION GRADE
 * 
 * Edge function para processar fila de campanhas em massa.
 * Envia templates para recipients em lotes respeitando rate limits.
 * 
 * IMPORTANTE: Usa notificameProvider compartilhado para garantir
 * formato correto do payload (mesmo formato do inbox-send-template).
 * 
 * Features:
 * - Rate limiting com backoff exponencial para 429
 * - Retry automático para falhas temporárias
 * - Logs DETALHADOS para diagnóstico (request/response completo)
 * - SENT só com provider_message_id confirmado
 * - Criação de mensagem no Inbox após SENT
 * - Contadores em tempo real
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificameProvider } from '../_shared/providers/notificame.ts';
import { Channel, ChannelProviderConfig, TemplateVariable } from '../_shared/providers/types.ts';
import { isChannelBlockingError, isPaymentError, PAYMENT_ERROR_CODES } from '../_shared/providers/errors.ts';
import { resolveTemplateContract, type TemplateContract } from '../_shared/templateParams.ts';

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function createSuccessResponse(traceId: string, data: unknown, status = 200): Response {
  const body: StandardResponse = {
    ok: true,
    traceId,
    data,
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
  details?: unknown
): Response {
  const body: StandardResponse = {
    ok: false,
    traceId,
    error: { code, message, details },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-trace-id': traceId },
  });
}

// ============================================
// CONFIGURATION
// ============================================

const SPEED_CONFIG = {
  slow: { batchSize: 10, delayMs: 3000, batchDelayMs: 10000 },
  normal: { batchSize: 20, delayMs: 1500, batchDelayMs: 5000 },
  fast: { batchSize: 50, delayMs: 800, batchDelayMs: 2000 },
};

const MAX_EXECUTION_TIME_MS = 140000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// ============================================
// TYPES
// ============================================

interface ProcessRequest {
  campaign_id: string;
  speed?: 'slow' | 'normal' | 'fast';
}

interface CampaignData {
  id: string;
  tenant_id: string;
  channel_id: string;
  template_id: string;
  name: string;
  status: string;
  template_variables: Record<string, string> | null;
  template: {
    id: string;
    name: string;
    language: string;
    status: string;
    variables_schema: unknown;
    components?: unknown;
  };
  channel: {
    id: string;
    tenant_id: string;
    name: string;
    phone_number: string | null;
    status: string;
    provider_config: ChannelProviderConfig | null;
    provider_phone_id: string | null;
    provider: { name: string };
  };
}

interface RecipientData {
  id: string;
  contact_id: string;
  campaign_id: string;
  status: string;
  attempts: number;
  variables: Record<string, string> | null;
  contact: {
    id: string;
    phone: string;
    name: string | null;
  };
}

interface CampaignStats {
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  retryScheduled: number;
  rateLimited: boolean;
  errors: Array<{phone: string; error: string; code: string}>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.floor(exponentialDelay + jitter);
}

// ============================================
// TEMPLATE PARAMS — CONTRACT-DRIVEN BUILDER
// ============================================

interface SchemaVariable {
  type?: string;
  key?: string;
  label?: string;
  fallback?: string;
}

/**
 * Normaliza um valor de parâmetro.
 */
function normalizeParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

/**
 * Extrai o primeiro nome de um nome completo.
 */
function extractFirstName(fullName: string | null | undefined): string | null {
  const normalized = normalizeParam(fullName);
  if (!normalized) return null;
  const parts = normalized.split(/\s+/);
  const firstName = parts[0];
  if (firstName && firstName.length > 0) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  return null;
}

/**
 * CONTRACT-DRIVEN template variable builder.
 * Uses TemplateContract (from resolveTemplateContract) as the SINGLE SOURCE OF TRUTH.
 * 
 * Rules:
 * - 0 dynamic params → return empty (NO components sent to Meta)
 * - N body params → build exactly N body params
 * - Dynamic buttons only → build with correct index + sub_type
 * - Static media headers → skip (Meta has the file)
 * - Never inject params when template doesn't expect them
 */
function buildTemplateVariablesFromContract(
  contract: TemplateContract,
  variablesSchema: Record<string, SchemaVariable[]> | null,
  recipientVars: Record<string, string> | null,
  campaignVars: Record<string, string> | null,
  contactName: string | null
): {
  variables: Record<string, TemplateVariable[]>;
  buttonMeta: Array<{ index: number; sub_type: 'url' | 'quick_reply' | 'phone_number' }>;
} {
  // CONTRACT CHECK: If template has 0 dynamic params, send clean payload
  if (contract.totalDynamicParams === 0) {
    console.log('[Contract] ✅ Template has 0 dynamic params — clean payload (no components)');
    return { variables: {}, buttonMeta: [] };
  }

  console.log(`[Contract] Building params: body=${contract.body.dynamicParams}, header=${contract.header.dynamicParams}, buttons=${contract.buttons.filter(b => b.hasDynamicParam).length}`);

  const result: Record<string, TemplateVariable[]> = {};
  const buttonMeta: Array<{ index: number; sub_type: 'url' | 'quick_reply' | 'phone_number' }> = [];
  const mergedVars: Record<string, string> = { ...campaignVars, ...recipientVars };
  const namePatterns = ['nome', 'name', 'primeiro_nome', 'first_name', 'cliente'];

  // ── BODY params ──
  if (contract.body.dynamicParams > 0) {
    const bodyVars: TemplateVariable[] = [];
    const schemaBody = variablesSchema?.body || [];

    for (let i = 0; i < contract.body.dynamicParams; i++) {
      const schemaVar = schemaBody[i];
      const paramName = contract.body.paramNames[i] || `${i + 1}`;
      let value: string | null = null;

      // 1. Schema key
      if (schemaVar?.key && mergedVars[schemaVar.key]) {
        value = normalizeParam(mergedVars[schemaVar.key]);
      }
      // 2. Param name as key
      if (!value && mergedVars[paramName]) {
        value = normalizeParam(mergedVars[paramName]);
      }
      // 3. Indexed keys
      if (!value) value = normalizeParam(mergedVars[`var_${i + 1}`]);
      if (!value) value = normalizeParam(mergedVars[`${i + 1}`]);

      // 4. First param or name-like variable → contact first name
      const isNameVar = namePatterns.includes(paramName.toLowerCase());
      if (!value && (i === 0 || isNameVar)) {
        value = extractFirstName(contactName);
      }

      // 5. Schema fallback
      if (!value && schemaVar?.fallback) value = normalizeParam(schemaVar.fallback);
      // 6. Default fallback
      if (!value) value = i === 0 ? 'Olá' : '';

      bodyVars.push({
        type: (schemaVar?.type || 'text') as TemplateVariable['type'],
        value,
      });
    }
    result.body = bodyVars;
    console.log(`[Contract] Body params: [${bodyVars.map(v => v.value).join(', ')}]`);
  }

  // ── HEADER params (text dynamic only) ──
  if (contract.header.type === 'text_dynamic' && contract.header.dynamicParams > 0) {
    const headerVars: TemplateVariable[] = [];
    const schemaHeader = variablesSchema?.header || [];

    for (let i = 0; i < contract.header.dynamicParams; i++) {
      const schemaVar = schemaHeader[i];
      const value =
        normalizeParam(mergedVars[schemaVar?.key || `header_${i + 1}`]) ||
        normalizeParam(schemaVar?.fallback) ||
        '';
      headerVars.push({ type: 'text', value });
    }
    result.header = headerVars;
    console.log(`[Contract] Header params: [${headerVars.map(v => v.value).join(', ')}]`);
  }

  // ── BUTTON params (only dynamic buttons) ──
  const dynamicBtns = contract.buttons.filter(b => b.hasDynamicParam);
  if (dynamicBtns.length > 0) {
    const btnVars: TemplateVariable[] = [];
    const schemaButton = variablesSchema?.button || [];

    for (let i = 0; i < dynamicBtns.length; i++) {
      const btn = dynamicBtns[i];
      const schemaVar = schemaButton[i];
      const value =
        normalizeParam(mergedVars[schemaVar?.key || `button_${i + 1}`]) ||
        normalizeParam(schemaVar?.fallback) ||
        '';
      btnVars.push({ type: 'text', value });

      const subType = btn.type === 'URL' ? 'url'
        : btn.type === 'QUICK_REPLY' ? 'quick_reply'
        : 'phone_number';
      buttonMeta.push({ index: btn.index, sub_type: subType as 'url' | 'quick_reply' | 'phone_number' });
    }
    result.button = btnVars;
    console.log(`[Contract] Button params: [${btnVars.map(v => v.value).join(', ')}] meta=${JSON.stringify(buttonMeta)}`);
  }

  // ── VALIDATION LOG ──
  const totalBuilt = (result.body?.length || 0) + (result.header?.length || 0) + (result.button?.length || 0);
  if (totalBuilt !== contract.totalDynamicParams) {
    console.error(`[Contract] ⚠️ COUNT MISMATCH! expected=${contract.totalDynamicParams} built=${totalBuilt}`);
  } else {
    console.log(`[Contract] ✅ Params validated: total=${totalBuilt}`);
  }

  return { variables: result, buttonMeta };
}

/**
 * Pre-send validation: checks built payload against template contract.
 * Returns { valid, errors } — if invalid, message should NOT be sent.
 */
function validatePayloadAgainstContract(
  contract: TemplateContract,
  variables: Record<string, TemplateVariable[]>,
  buttonMeta: Array<{ index: number; sub_type: string }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: If contract expects 0 params, variables must be empty
  if (contract.totalDynamicParams === 0) {
    const hasBody = variables.body && variables.body.length > 0;
    const hasHeader = variables.header && variables.header.length > 0;
    const hasButton = variables.button && variables.button.length > 0;
    if (hasBody || hasHeader || hasButton) {
      errors.push(`Template expects 0 params but payload has: body=${variables.body?.length || 0}, header=${variables.header?.length || 0}, button=${variables.button?.length || 0}`);
    }
  }

  // Rule 2: Body count must match
  if (contract.body.dynamicParams > 0 && (variables.body?.length || 0) !== contract.body.dynamicParams) {
    errors.push(`Body: expected ${contract.body.dynamicParams} params, got ${variables.body?.length || 0}`);
  }

  // Rule 3: No body params when template has 0 body vars
  if (contract.body.dynamicParams === 0 && variables.body && variables.body.length > 0) {
    errors.push(`Body: template has 0 body vars but ${variables.body.length} params provided`);
  }

  // Rule 4: Header consistency
  if (contract.header.isMediaStatic && variables.header && variables.header.length > 0) {
    errors.push(`Header: static media header should not have text params`);
  }

  // Rule 5: Button index must match template
  for (const meta of buttonMeta) {
    const templateBtn = contract.buttons.find(b => b.index === meta.index);
    if (!templateBtn) {
      errors.push(`Button: index ${meta.index} not found in template`);
    } else if (!templateBtn.hasDynamicParam) {
      errors.push(`Button: index ${meta.index} is static but param was provided`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Renderiza preview REAL do template para o Inbox
 * Busca o texto do BODY do template e substitui {{1}}, {{2}}, etc. pelos valores reais
 * Fallback: mostra os valores das variáveis de forma amigável
 */
function renderTemplatePreview(
  templateName: string, 
  variables: Record<string, TemplateVariable[]>, 
  templateComponents?: unknown,
  contactName?: string | null
): string {
  const bodyVars = variables.body || [];
  
  // 1. Tentar extrair texto do BODY do template e substituir variáveis
  if (templateComponents && Array.isArray(templateComponents)) {
    const bodyComponent = templateComponents.find(
      (c: Record<string, unknown>) => c.type === 'BODY' || c.type === 'body'
    ) as Record<string, unknown> | undefined;
    
    if (bodyComponent?.text) {
      let bodyText = String(bodyComponent.text);
      
      // Substituir {{1}}, {{2}}, etc. pelos valores reais
      bodyVars.forEach((v, i) => {
        const placeholder = `{{${i + 1}}}`;
        const value = v.value || '';
        bodyText = bodyText.replace(placeholder, value);
      });
      
      // Se ainda houver placeholders não preenchidos, limpar
      bodyText = bodyText.replace(/\{\{\d+\}\}/g, '');
      
      if (bodyText.trim()) {
        return bodyText.trim();
      }
    }
  }
  
  // 2. Fallback: mostrar valores das variáveis de forma amigável
  if (bodyVars.length === 0) {
    // Template sem variáveis no body - só nome
    return `Mensagem de template`;
  }
  
  // Concatenar valores das variáveis que foram preenchidas
  const friendlyValues = bodyVars
    .map((v) => v.value)
    .filter(Boolean)
    .join(' | ');
  
  return friendlyValues || `Mensagem de template`;
}

function logCampaignStats(campaignName: string, stats: CampaignStats) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║ CAMPAIGN BATCH SUMMARY: ${campaignName.substring(0, 37).padEnd(37)}║
╠═══════════════════════════════════════════════════════════════╣
║ Processed:      ${String(stats.processed).padStart(5)}                                      ║
║ Success:        ${String(stats.success).padStart(5)} ✅                                     ║
║ Failed:         ${String(stats.failed).padStart(5)} ❌                                     ║
║ Retry Scheduled:${String(stats.retryScheduled).padStart(5)} 🔄                                     ║
║ Rate Limited:   ${(stats.rateLimited ? 'YES' : 'NO').padStart(5)}                                      ║
╚═══════════════════════════════════════════════════════════════╝`);
  
  if (stats.errors.length > 0) {
    console.log(`[Campaign] Errors:`);
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.phone}: [${e.code}] ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }
}

// ============================================
// INBOX INTEGRATION - Criar mensagem outbound
// ============================================

async function createOutboundMessageInInbox(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  channelId: string,
  contactId: string,
  templateName: string,
  templateVars: Record<string, TemplateVariable[]>,
  templateComponents: unknown,
  providerMessageId: string,
  sentByUserId: string | null
): Promise<{ conversationId: string | null; messageId: string | null }> {
  try {
    // ============================================
    // TOMBSTONE LOGIC: Não reativar conversas deletadas pelo usuário
    // Se deleted_reason = 'user_deleted', criar NOVA conversa
    // ============================================
    
    let conversationId: string | null = null;
    let needsReactivation = false;
    
    // 1. Buscar conversa ativa
    const { data: activeConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('channel_id', channelId)
      .eq('contact_id', contactId)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (activeConv) {
      conversationId = activeConv.id;
      console.log(`[Inbox] Using existing active conversation: ${conversationId}`);
    } else {
      // 2. Buscar conversa soft-deleted SEM tombstone 'user_deleted'
      // Se deleted_reason = 'user_deleted', NÃO reativar - criar nova
      const { data: deletedConv } = await supabase
        .from('conversations')
        .select('id, deleted_reason')
        .eq('tenant_id', tenantId)
        .eq('channel_id', channelId)
        .eq('contact_id', contactId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (deletedConv) {
        // CRITICAL: Verificar tombstone
        if (deletedConv.deleted_reason === 'user_deleted') {
          // Tombstone ativo: criar NOVA conversa sem histórico
          console.log(`[Inbox] TOMBSTONE: conversation ${deletedConv.id} has deleted_reason=user_deleted, creating NEW`);
          conversationId = null; // Force creation of new conversation
        } else {
          // Pode reativar (deleted_reason = null ou 'system_deleted')
          conversationId = deletedConv.id;
          needsReactivation = true;
          console.log(`[Inbox] Reactivating soft-deleted conversation: ${conversationId}`);
        }
      }
    }
    
    // 3. Se não encontrou conversa ativa (ou há tombstone), criar nova
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          channel_id: channelId,
          contact_id: contactId,
          status: 'open',
          last_message_at: new Date().toISOString(),
          last_message_preview: `📋 ${templateName}`,
          deleted_reason: null, // Nova conversa sem tombstone
        })
        .select('id')
        .single();
      
      if (convError) {
        console.error('[Inbox] Failed to create conversation:', convError);
        return { conversationId: null, messageId: null };
      }
      
      conversationId = newConv.id;
      console.log(`[Inbox] Created NEW conversation: ${conversationId}`);
    }
    
    // 2. Criar mensagem outbound - usar texto REAL do template
    const messageContent = renderTemplatePreview(templateName, templateVars, templateComponents, null);
    
    const { data: message, error: msgError } = await supabase
      .from('mt_messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        channel_id: channelId,
        contact_id: contactId,
        direction: 'outbound',
        type: 'template',
        content: messageContent,
        template_name: templateName,
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
        sent_by_user_id: sentByUserId,
      })
      .select('id')
      .single();
    
    if (msgError) {
      console.error('[Inbox] Failed to create message:', msgError);
      return { conversationId, messageId: null };
    }
    
    // 3. Atualizar conversa com última mensagem - também limpar deleted_at se necessário
    const previewContent = messageContent.length > 50 
      ? messageContent.substring(0, 50) + '...'
      : messageContent;
    
    const updateData: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      last_message_preview: previewContent,
      updated_at: new Date().toISOString(),
    };
    
    // CRITICAL: Reativar conversa se estava soft-deleted (sem tombstone 'user_deleted')
    if (needsReactivation) {
      updateData.deleted_at = null;
      updateData.deleted_reason = null; // Limpar tombstone
      updateData.status = 'open';
      console.log(`[Inbox] Clearing deleted_at to reactivate conversation ${conversationId}`);
    }
    
    await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId);
    
    console.log(`[Inbox] Created outbound message ${message.id} in conversation ${conversationId} (reactivated: ${needsReactivation})`);
    
    return { conversationId, messageId: message.id };
  } catch (error) {
    console.error('[Inbox] Error creating outbound message:', error);
    return { conversationId: null, messageId: null };
  }
}

// ============================================
// MAIN PROCESSOR
// ============================================

async function processCampaignBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaign: CampaignData,
  speed: 'slow' | 'normal' | 'fast',
  startTime: number
) {
  const config = SPEED_CONFIG[speed];
  const stats: CampaignStats = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    retryScheduled: 0,
    rateLimited: false,
    errors: [],
  };
  
  console.log(`
════════════════════════════════════════════════════════════════
CAMPAIGN BATCH START
════════════════════════════════════════════════════════════════
Campaign: ${campaign.name} (${campaign.id})
Template: ${campaign.template.name}
Channel: ${campaign.channel.name} (${campaign.channel_id})
Speed: ${speed} (batch=${config.batchSize}, delay=${config.delayMs}ms)
════════════════════════════════════════════════════════════════`);
  
  // Validate channel config
  if (!campaign.channel.provider_config) {
    console.error(`[Campaign] ❌ No provider_config for channel ${campaign.channel_id}`);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Channel not configured', code: 'NO_CONFIG' }] 
    };
  }
  
  if (!campaign.channel.provider_config.api_key) {
    console.error(`[Campaign] ❌ No api_key for channel ${campaign.channel_id}`);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Token not configured', code: 'NO_TOKEN' }] 
    };
  }
  
  if (!campaign.channel.provider_config.subscription_id) {
    console.error(`[Campaign] ❌ No subscription_id for channel ${campaign.channel_id}`);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Subscription ID not configured', code: 'NO_SUBSCRIPTION' }] 
    };
  }
  
  // Validate channel status
  if (campaign.channel.status !== 'connected') {
    console.error(`[Campaign] ❌ Channel ${campaign.channel_id} not connected (status: ${campaign.channel.status})`);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Channel not connected', code: 'CHANNEL_DISCONNECTED' }] 
    };
  }
  
  // Validate template status
  if (campaign.template.status !== 'approved') {
    console.error(`[Campaign] ❌ Template not approved (status: ${campaign.template.status})`);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: 'Template not approved', code: 'TEMPLATE_NOT_APPROVED' }] 
    };
  }
  
  // Build Channel object for provider
  const channel: Channel = {
    id: campaign.channel.id,
    tenant_id: campaign.channel.tenant_id,
    provider_id: '',
    name: campaign.channel.name,
    phone_number: campaign.channel.phone_number || undefined,
    status: campaign.channel.status as Channel['status'],
    provider_config: campaign.channel.provider_config,
    provider_phone_id: campaign.channel.provider_phone_id || undefined,
  };
  
  // Log channel config (masked)
  const maskedToken = campaign.channel.provider_config.api_key.length > 8 
    ? `***${campaign.channel.provider_config.api_key.slice(-4)}`
    : '***';
  console.log(`[Campaign] Channel config: token=${maskedToken}, subscription_id=${campaign.channel.provider_config.subscription_id?.substring(0, 8)}...`);
  
  // Fetch queued recipients
  const now = new Date().toISOString();
  const { data: recipients, error: recipientsError } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      contact_id,
      campaign_id,
      status,
      attempts,
      variables,
      contact:mt_contacts!inner(id, phone, name)
    `)
    .eq('campaign_id', campaign.id)
    .or(`status.eq.queued,and(status.eq.failed,next_retry_at.lte.${now},attempts.lt.${MAX_RETRIES})`)
    .order('created_at', { ascending: true })
    .limit(config.batchSize);
  
  if (recipientsError) {
    console.error(`[Campaign] Failed to fetch recipients:`, recipientsError);
    return { 
      processed: 0, success: 0, failed: 0, retryScheduled: 0,
      finished: false, rateLimited: false,
      errors: [{ phone: 'N/A', error: recipientsError.message, code: 'DB_ERROR' }] 
    };
  }
  
  if (!recipients || recipients.length === 0) {
    console.log(`[Campaign] ✅ No more queued recipients, campaign done`);
    return { processed: 0, success: 0, failed: 0, retryScheduled: 0, finished: true, rateLimited: false, errors: [] };
  }
  
  console.log(`[Campaign] Processing ${recipients.length} recipients...`);
  
  // Get campaign creator
  const { data: campaignData } = await supabase
    .from('mt_campaigns')
    .select('created_by_user_id')
    .eq('id', campaign.id)
    .single();
  
  const sentByUserId = campaignData?.created_by_user_id || null;
  
  let currentBackoff = 0;
  
  // Process each recipient
  for (const recipient of recipients as unknown as RecipientData[]) {
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      console.log(`[Campaign] ⏰ Time limit reached, stopping batch`);
      break;
    }
    
    // Check campaign status periodically
    if (stats.processed > 0 && stats.processed % 10 === 0) {
      const { data: currentCampaign } = await supabase
        .from('mt_campaigns')
        .select('status')
        .eq('id', campaign.id)
        .single();
      
      if (currentCampaign?.status !== 'running') {
        console.log(`[Campaign] Campaign status changed to ${currentCampaign?.status}, stopping`);
        break;
      }
    }
    
    const phone = normalizePhone(recipient.contact.phone);
    const isRetry = recipient.attempts > 0;
    
    console.log(`
────────────────────────────────────────────────────────────────
[${stats.processed + 1}/${recipients.length}] ${isRetry ? '🔄 RETRY' : '📤 SEND'}: ${phone}
Contact: ${recipient.contact.name || 'N/A'} (${recipient.contact_id})
Attempt: ${recipient.attempts + 1}/${MAX_RETRIES}
────────────────────────────────────────────────────────────────`);
    
    // Apply backoff if rate limited
    if (currentBackoff > 0) {
      console.log(`[Campaign] ⏳ Backoff delay: ${currentBackoff}ms`);
      await sleep(currentBackoff);
      currentBackoff = 0;
    }
    
    try {
      // Gerar correlation_id único para esta mensagem
      const correlationId = crypto.randomUUID();
      
      // ── CONTRACT-DRIVEN: Resolve template contract once per batch (reuse) ──
      const contract = resolveTemplateContract(campaign.template.components);
      
      // Build template variables using contract (NOT heuristic)
      const { variables: templateVars, buttonMeta } = buildTemplateVariablesFromContract(
        contract,
        campaign.template.variables_schema as Record<string, SchemaVariable[]> | null,
        recipient.variables,
        campaign.template_variables,
        recipient.contact.name
      );
      
      // ── PRE-SEND VALIDATION ──
      const validation = validatePayloadAgainstContract(contract, templateVars, buttonMeta);
      if (!validation.valid) {
        console.error(`[Contract] ❌ PAYLOAD MISMATCH PRECHECK for ${phone}:`, validation.errors);
        
        // Mark as failed with clear internal error
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            attempts: recipient.attempts + 1,
            last_error: `[TEMPLATE_PAYLOAD_MISMATCH_PRECHECK] ${validation.errors.join('; ')}`,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
            correlation_id: correlationId,
            provider_error_code: 'TEMPLATE_PAYLOAD_MISMATCH_PRECHECK',
            provider_error_message: validation.errors.join('; '),
          })
          .eq('id', recipient.id);
        
        stats.failed++;
        stats.errors.push({ phone, error: validation.errors.join('; '), code: 'TEMPLATE_PAYLOAD_MISMATCH_PRECHECK' });
        stats.processed++;
        continue;
      }
      
      console.log(`[Campaign] Correlation ID: ${correlationId}`);
      console.log(`[Campaign] Contract: total=${contract.totalDynamicParams}, header=${contract.header.type}, body=${contract.body.dynamicParams}, dynBtns=${contract.buttons.filter(b=>b.hasDynamicParam).length}`);
      console.log(`[Campaign] Template variables:`, JSON.stringify(templateVars));
      
      // ====================================================
      // USAR PROVIDER COMPARTILHADO (mesmo formato do inbox)
      // ====================================================
      const result = await notificameProvider.sendTemplate({
        channel,
        to: phone,
        template_name: campaign.template.name,
        language: campaign.template.language || 'pt_BR',
        variables: templateVars,
        buttonMeta: buttonMeta.length > 0 ? buttonMeta : undefined,
        // No media for static headers — Meta already has the file
      });
      
      console.log(`[Campaign] Provider result:`, JSON.stringify({
        success: result.success,
        provider_message_id: result.provider_message_id,
        error: result.error,
      }));
      
      if (result.success && result.provider_message_id) {
        // ✅ SENT CONFIRMADO COM MESSAGE_ID
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            provider_message_id: result.provider_message_id,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
            next_retry_at: null,
            correlation_id: correlationId,
          })
          .eq('id', recipient.id);
        
        // 🔄 CRIAR MENSAGEM NO INBOX
        await createOutboundMessageInInbox(
          supabase,
          campaign.tenant_id,
          campaign.channel_id,
          recipient.contact_id,
          campaign.template.name,
          templateVars,
          campaign.template.components, // Template components para renderizar preview real
          result.provider_message_id,
          sentByUserId
        );
        
        stats.success++;
        console.log(`[Campaign] ✅ CONFIRMED SENT: ${phone}, provider_message_id: ${result.provider_message_id}, correlation_id: ${correlationId}`);
        
      } else {
        // ❌ FALHA
        const errorCode = result.error?.code || 'UNKNOWN';
        const errorMessage = result.error?.detail || 'Unknown error';
        const isRetryable = result.error?.is_retryable ?? false;
        
        // CRITICAL: Detectar erro 131042 (problema de pagamento)
        const isPaymentBlockingError = isPaymentError(errorCode, errorMessage) || 
                                        PAYMENT_ERROR_CODES.includes(errorCode) ||
                                        errorMessage.includes('131042') ||
                                        errorMessage.toLowerCase().includes('payment');
        
        const isChannelBlocking = result.error?.blocks_channel || 
                                   isChannelBlockingError(errorCode, errorMessage) ||
                                   isPaymentBlockingError;
        
        // Check for auth errors
        const isAuthError = result.error?.category === 'auth' ||
                           errorCode.includes('TOKEN') ||
                           errorCode.includes('AUTH') ||
                           errorCode.includes('UNAUTHORIZED');
        
        // Se é erro que bloqueia o canal (pagamento, auth, etc)
        if (isChannelBlocking || isAuthError || isPaymentBlockingError) {
          const blockReason = isPaymentBlockingError 
            ? 'PAYMENT_ISSUE' 
            : (isAuthError ? 'TOKEN_INVALID' : 'PROVIDER_BLOCKED');
          
          console.error(`[Campaign] 🚨 CHANNEL BLOCKING ERROR - ${blockReason}: ${errorCode} - ${errorMessage}`);
          
          // Marcar mensagem como falha
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              attempts: recipient.attempts + 1,
              last_error: `[${errorCode}] ${errorMessage}`,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
              correlation_id: correlationId,
              provider_error_code: errorCode,
              provider_error_message: errorMessage,
            })
            .eq('id', recipient.id);
          
          stats.failed++;
          stats.errors.push({ phone, error: errorMessage, code: errorCode });
          
          // BLOQUEAR O CANAL
          await supabase
            .from('channels')
            .update({
              blocked_by_provider: true,
              blocked_reason: errorMessage,
              blocked_at: new Date().toISOString(),
              blocked_error_code: errorCode,
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.channel_id);
          
          console.error(`[Campaign] 🔒 Channel ${campaign.channel_id} BLOCKED due to: ${blockReason}`);
          
          // PAUSAR A CAMPANHA
          await supabase
            .from('mt_campaigns')
            .update({
              status: 'paused',
              updated_at: new Date().toISOString(),
            })
            .eq('id', campaign.id);
          
          return { 
            processed: stats.processed + 1, 
            success: stats.success, 
            failed: stats.failed, 
            retryScheduled: stats.retryScheduled,
            finished: false, 
            rateLimited: false,
            errors: stats.errors,
            paused_reason: blockReason,
            channel_blocked: true,
            blocking_error_code: errorCode,
          };
        }
        
        // Check rate limit
        if (result.error?.category === 'rate_limit') {
          stats.rateLimited = true;
          currentBackoff = calculateBackoff(recipient.attempts);
          console.log(`[Campaign] ⏳ Rate limited, backoff: ${currentBackoff}ms`);
        }
        
        // Retry or fail permanently
        if (isRetryable && recipient.attempts < MAX_RETRIES - 1) {
          const nextRetryAt = new Date(Date.now() + calculateBackoff(recipient.attempts + 1));
          
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              attempts: recipient.attempts + 1,
              last_error: errorMessage,
              next_retry_at: nextRetryAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          
          stats.retryScheduled++;
          console.log(`[Campaign] 🔄 Scheduled retry for ${phone} at ${nextRetryAt.toISOString()}`);
        } else {
          await supabase
            .from('campaign_recipients')
            .update({
              status: 'failed',
              attempts: recipient.attempts + 1,
              last_error: errorMessage,
              next_retry_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          
          stats.failed++;
          stats.errors.push({ phone, error: errorMessage, code: errorCode });
          console.log(`[Campaign] ❌ Failed permanently for ${phone}: ${errorMessage}`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Campaign] Exception for ${phone}:`, err);
      
      if (recipient.attempts < MAX_RETRIES - 1) {
        const nextRetryAt = new Date(Date.now() + calculateBackoff(recipient.attempts + 1));
        
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            attempts: recipient.attempts + 1,
            last_error: errorMsg,
            next_retry_at: nextRetryAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        stats.retryScheduled++;
      } else {
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            attempts: recipient.attempts + 1,
            last_error: errorMsg,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        stats.failed++;
        stats.errors.push({ phone, error: errorMsg, code: 'EXCEPTION' });
      }
    }
    
    stats.processed++;
    
    // Delay between messages
    if (stats.processed < recipients.length && !stats.rateLimited) {
      await sleep(config.delayMs);
    }
  }
  
  // Update campaign counters
  const { data: counts } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaign.id);
  
  if (counts) {
    const sentCount = counts.filter((r: {status: string}) => r.status === 'sent').length;
    const deliveredCount = counts.filter((r: {status: string}) => r.status === 'delivered').length;
    const readCount = counts.filter((r: {status: string}) => r.status === 'read').length;
    const failedCount = counts.filter((r: {status: string}) => r.status === 'failed').length;
    const queuedCount = counts.filter((r: {status: string}) => r.status === 'queued').length;
    
    const isFinished = queuedCount === 0 && failedCount === counts.filter((r: {status: string}) => r.status === 'failed').length;
    
    await supabase
      .from('mt_campaigns')
      .update({
        sent_count: sentCount,
        delivered_count: deliveredCount,
        read_count: readCount,
        failed_count: failedCount,
        status: isFinished ? 'done' : 'running',
        completed_at: isFinished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);
    
    console.log(`[Campaign] Counters: sent=${sentCount}, delivered=${deliveredCount}, read=${readCount}, failed=${failedCount}, queued=${queuedCount}`);
  }
  
  // Log final stats
  logCampaignStats(campaign.name, stats);
  
  console.log(`
════════════════════════════════════════════════════════════════
CAMPAIGN BATCH COMPLETE
════════════════════════════════════════════════════════════════
Processed: ${stats.processed}
Success:   ${stats.success}
Failed:    ${stats.failed}
Retry:     ${stats.retryScheduled}
Finished:  ${stats.processed === 0 || (recipients && recipients.length < config.batchSize)}
Rate Limited: ${stats.rateLimited}
════════════════════════════════════════════════════════════════`);
  
  return {
    processed: stats.processed,
    success: stats.success,
    failed: stats.failed,
    retryScheduled: stats.retryScheduled,
    finished: stats.processed === 0 || (recipients && recipients.length < config.batchSize),
    rateLimited: stats.rateLimited,
    errors: stats.errors,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const traceId = generateTraceId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { ...corsHeaders, 'x-trace-id': traceId } });
  }
  
  const startTime = Date.now();
  
  console.log(`\n[Campaign] ══════════════════════════════════════════════`);
  console.log(`[Campaign] TraceId: ${traceId}`);
  
  try {
    let body: ProcessRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error(`[Campaign][${traceId}] Invalid JSON body:`, parseError);
      return createErrorResponse(traceId, 'INVALID_JSON', 'Corpo da requisição não é JSON válido', 400);
    }
    
    const { campaign_id, speed = 'normal' } = body;
    
    if (!campaign_id) {
      console.error(`[Campaign][${traceId}] Missing campaign_id`);
      return createErrorResponse(traceId, 'MISSING_CAMPAIGN_ID', 'campaign_id é obrigatório', 400);
    }
    
    console.log(`[Campaign][${traceId}] Processing: ${campaign_id}`);
    console.log(`[Campaign][${traceId}] Speed: ${speed}`);
    
    const supabase = getSupabaseAdmin();
    
    // Fetch campaign with template and channel
    const { data: campaign, error: campaignError } = await supabase
      .from('mt_campaigns')
      .select(`
        id,
        tenant_id,
        channel_id,
        template_id,
        name,
        status,
        template_variables,
        template:mt_templates!inner(
          id, name, language, status, variables_schema, components
        ),
        channel:channels!inner(
          id, tenant_id, name, phone_number, status, provider_config, provider_phone_id,
          provider:providers!inner(name)
        )
      `)
      .eq('id', campaign_id)
      .single();
    
    if (campaignError || !campaign) {
      console.error(`[Campaign][${traceId}] Campaign not found:`, campaignError);
      return createErrorResponse(
        traceId,
        'CAMPAIGN_NOT_FOUND',
        'Campanha não encontrada',
        404,
        { db_error: campaignError?.message }
      );
    }
    
    // Log context for debugging
    console.log(`[Campaign][${traceId}] Context: tenant=${campaign.tenant_id}, channel=${campaign.channel_id}`);
    
    // Check campaign status - NOT an error, just a no-op
    if (campaign.status !== 'running') {
      console.log(`[Campaign][${traceId}] Campaign not running (status: ${campaign.status}) - returning noop`);
      // Return 200 with noop flag - this is expected behavior, not an error
      return createSuccessResponse(traceId, {
        campaign_id,
        noop: true,
        reason: 'CAMPAIGN_NOT_RUNNING',
        current_status: campaign.status,
        processed: 0,
        success: 0,
        failed: 0,
        finished: true,
      });
    }
    
    // Process batch
    const result = await processCampaignBatch(
      supabase,
      campaign as unknown as CampaignData,
      speed,
      startTime
    );
    
    console.log(`[Campaign][${traceId}] Completed: processed=${result.processed}, success=${result.success}, failed=${result.failed}`);
    
    return createSuccessResponse(traceId, {
      campaign_id,
      ...result,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[Campaign][${traceId}] EXCEPTION:`, errorMessage);
    console.error(`[Campaign][${traceId}] Stack:`, errorStack);
    
    return createErrorResponse(
      traceId,
      'INTERNAL_ERROR',
      errorMessage,
      500,
      { stack: errorStack?.substring(0, 500) }
    );
  }
});
