/**
 * Campaign Process Queue
 * 
 * Edge function para processar fila de campanhas em massa.
 * Envia templates para recipients em lotes respeitando rate limits.
 * 
 * Endpoints:
 * - POST /campaign-process-queue → Processa próximo batch da campanha
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  getProvider,
  SendTemplateRequest,
  Channel,
} from '../_shared/providers/index.ts';

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// CONFIGURATION
// ============================================

// Rate limit configurations (messages per batch, delay between messages)
const SPEED_CONFIG = {
  slow: { batchSize: 10, delayMs: 3000, batchDelayMs: 10000 },
  normal: { batchSize: 20, delayMs: 1500, batchDelayMs: 5000 },
  fast: { batchSize: 50, delayMs: 800, batchDelayMs: 2000 },
};

// Max execution time safety margin
const MAX_EXECUTION_TIME_MS = 140000; // 140s (function has 150s limit)

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
  };
  channel: Channel & {
    provider: { name: string };
  };
}

interface RecipientData {
  id: string;
  contact_id: string;
  campaign_id: string;
  status: string;
  variables: Record<string, string> | null;
  contact: {
    id: string;
    phone: string;
    name: string | null;
  };
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

interface TemplateVariable {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  value: string;
  currency_code?: string;
  amount_1000?: number;
  fallback_value?: string;
}

function buildTemplateVariables(
  variablesSchema: Record<string, unknown[]> | null,
  recipientVars: Record<string, string> | null,
  campaignVars: Record<string, string> | null,
  contactName: string | null
): Record<string, TemplateVariable[]> {
  if (!variablesSchema) return {};
  
  const result: Record<string, TemplateVariable[]> = {};
  
  // Merge variables (recipient takes precedence)
  const mergedVars: Record<string, string> = {
    ...campaignVars,
    ...recipientVars,
    nome: contactName || recipientVars?.nome || campaignVars?.nome || '',
    name: contactName || recipientVars?.name || campaignVars?.name || '',
  };
  
  // Build body variables
  if (Array.isArray(variablesSchema.body)) {
    result.body = variablesSchema.body.map((v: any, idx: number) => ({
      type: (v.type || 'text') as TemplateVariable['type'],
      value: mergedVars[v.key as string] || mergedVars[`${idx + 1}`] || `{{${idx + 1}}}`,
    }));
  }
  
  return result;
}

// ============================================
// MAIN PROCESSOR
// ============================================

async function processCampaignBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  campaign: CampaignData,
  speed: 'slow' | 'normal' | 'fast'
): Promise<{
  processed: number;
  success: number;
  failed: number;
  finished: boolean;
  errors: string[];
}> {
  const startTime = Date.now();
  const config = SPEED_CONFIG[speed];
  const errors: string[] = [];
  let processed = 0;
  let success = 0;
  let failed = 0;
  
  console.log(`[Campaign] Processing batch for ${campaign.name}, speed: ${speed}`);
  console.log(`[Campaign] Batch size: ${config.batchSize}, delay: ${config.delayMs}ms`);
  
  // Get provider
  const providerName = campaign.channel.provider?.name || 'notificame';
  const provider = getProvider(providerName);
  
  if (!provider) {
    console.error(`[Campaign] Provider ${providerName} not found`);
    return { processed: 0, success: 0, failed: 0, finished: false, errors: [`Provider ${providerName} not found`] };
  }
  
  // Validate channel status
  if (campaign.channel.status !== 'connected') {
    console.error(`[Campaign] Channel ${campaign.channel_id} not connected`);
    return { processed: 0, success: 0, failed: 0, finished: false, errors: ['Channel not connected'] };
  }
  
  // Validate template status
  if (campaign.template.status !== 'approved') {
    console.error(`[Campaign] Template ${campaign.template_id} not approved`);
    return { processed: 0, success: 0, failed: 0, finished: false, errors: ['Template not approved'] };
  }
  
  // Fetch queued recipients (batch size)
  const { data: recipients, error: recipientsError } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      contact_id,
      campaign_id,
      status,
      variables,
      contact:mt_contacts!inner(id, phone, name)
    `)
    .eq('campaign_id', campaign.id)
    .eq('status', 'queued')
    .limit(config.batchSize);
  
  if (recipientsError) {
    console.error(`[Campaign] Failed to fetch recipients:`, recipientsError);
    return { processed: 0, success: 0, failed: 0, finished: false, errors: [recipientsError.message] };
  }
  
  if (!recipients || recipients.length === 0) {
    console.log(`[Campaign] No more queued recipients, campaign done`);
    return { processed: 0, success: 0, failed: 0, finished: true, errors: [] };
  }
  
  console.log(`[Campaign] Processing ${recipients.length} recipients`);
  
  // Process each recipient
  for (const recipient of recipients as unknown as RecipientData[]) {
    // Check time limit
    if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
      console.log(`[Campaign] Time limit reached, stopping batch`);
      break;
    }
    
    // Check campaign status (might have been paused/cancelled)
    if (processed > 0 && processed % 10 === 0) {
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
    console.log(`[Campaign] Sending to ${phone} (recipient: ${recipient.id})`);
    
    try {
      // Build template request
      const templateVars = buildTemplateVariables(
        campaign.template.variables_schema as Record<string, unknown[]>,
        recipient.variables,
        campaign.template_variables,
        recipient.contact.name
      );
      
      const sendRequest: SendTemplateRequest = {
        channel: campaign.channel as Channel,
        to: phone,
        template_name: campaign.template.name,
        language: campaign.template.language || 'pt_BR',
        variables: templateVars,
      };
      
      // Send template
      const result = await provider.sendTemplate(sendRequest);
      
      if (result.success) {
        // Update recipient as sent
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'sent',
            provider_message_id: result.provider_message_id,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        success++;
        console.log(`[Campaign] ✅ Sent to ${phone}, message_id: ${result.provider_message_id}`);
      } else {
        // Update recipient as failed
        const errorReason = result.error?.detail || 'Unknown error';
        
        await supabase
          .from('campaign_recipients')
          .update({
            status: 'failed',
            last_error: errorReason,
            attempts: 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        
        failed++;
        errors.push(`${phone}: ${errorReason}`);
        console.log(`[Campaign] ❌ Failed for ${phone}: ${errorReason}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      await supabase
        .from('campaign_recipients')
        .update({
          status: 'failed',
          last_error: errorMsg,
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recipient.id);
      
      failed++;
      errors.push(`${phone}: ${errorMsg}`);
      console.error(`[Campaign] Exception for ${phone}:`, err);
    }
    
    processed++;
    
    // Rate limit delay
    if (processed < recipients.length) {
      await sleep(config.delayMs);
    }
  }
  
  // Update campaign counters
  const { data: counts } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaign.id);
  
  if (counts) {
    const sentCount = counts.filter((r: any) => r.status === 'sent').length;
    const deliveredCount = counts.filter((r: any) => r.status === 'delivered').length;
    const readCount = counts.filter((r: any) => r.status === 'read').length;
    const failedCount = counts.filter((r: any) => r.status === 'failed').length;
    const queuedCount = counts.filter((r: any) => r.status === 'queued').length;
    
    await supabase
      .from('mt_campaigns')
      .update({
        sent_count: sentCount,
        delivered_count: deliveredCount,
        read_count: readCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
        // If no more queued, mark as done
        ...(queuedCount === 0 && {
          status: 'done',
          completed_at: new Date().toISOString(),
        }),
      })
      .eq('id', campaign.id);
    
    console.log(`[Campaign] Updated counters: sent=${sentCount}, delivered=${deliveredCount}, read=${readCount}, failed=${failedCount}, queued=${queuedCount}`);
  }
  
  // Check if finished
  const { count: remainingCount } = await supabase
    .from('campaign_recipients')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('status', 'queued');
  
  const finished = (remainingCount || 0) === 0;
  
  return { processed, success, failed, finished, errors };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const body: ProcessRequest = await req.json();
    const { campaign_id, speed = 'normal' } = body;
    
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: 'Missing campaign_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Campaign] Processing campaign: ${campaign_id}, speed: ${speed}`);
    
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
        template:mt_templates!inner(id, name, language, status, variables_schema),
        channel:channels!inner(
          id,
          tenant_id,
          name,
          phone_number,
          status,
          provider_config,
          provider_phone_id,
          provider:providers!inner(name)
        )
      `)
      .eq('id', campaign_id)
      .single();
    
    if (campaignError || !campaign) {
      console.error(`[Campaign] Campaign not found:`, campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate campaign status
    if (campaign.status !== 'running') {
      console.log(`[Campaign] Campaign not running (status: ${campaign.status})`);
      return new Response(
        JSON.stringify({ 
          error: 'Campaign not running',
          status: campaign.status,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process batch
    const result = await processCampaignBatch(
      supabase,
      campaign as unknown as CampaignData,
      speed
    );
    
    console.log(`[Campaign] Batch complete: processed=${result.processed}, success=${result.success}, failed=${result.failed}, finished=${result.finished}`);
    
    return new Response(
      JSON.stringify({
        campaign_id,
        ...result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[Campaign] Error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
