/**
 * Campaign Status Poll - Fallback para webhooks
 * 
 * Esta função verifica o status de mensagens que não receberam
 * webhook de confirmação após um tempo limite (90s).
 * 
 * Pode ser chamada manualmente ou via cron job.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

interface PendingMessage {
  id: string;
  provider_message_id: string;
  campaign_id: string;
  sent_at: string;
  tenant_id: string;
  channel_id: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  console.log('[StatusPoll] Starting status poll check');
  
  try {
    const supabase = getSupabaseAdmin();
    
    // Parse request body for optional filters
    let campaignId: string | null = null;
    let tenantId: string | null = null;
    let ageThresholdSeconds = 90; // Default: 90 seconds
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        campaignId = body.campaign_id;
        tenantId = body.tenant_id;
        if (body.age_threshold_seconds) {
          ageThresholdSeconds = Math.max(30, Math.min(3600, body.age_threshold_seconds));
        }
      } catch {
        // Ignore parse errors
      }
    }
    
    // Calculate threshold timestamp
    const thresholdTime = new Date(Date.now() - ageThresholdSeconds * 1000).toISOString();
    
    // Find messages in "sent" status that are older than threshold
    let query = supabase
      .from('campaign_recipients')
      .select(`
        id,
        provider_message_id,
        campaign_id,
        sent_at,
        mt_campaigns!inner(tenant_id, channel_id)
      `)
      .eq('status', 'sent')
      .not('provider_message_id', 'is', null)
      .lt('sent_at', thresholdTime)
      .order('sent_at', { ascending: true })
      .limit(100);
    
    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }
    
    const { data: pendingMessages, error: queryError } = await query;
    
    if (queryError) {
      console.error('[StatusPoll] Query error:', queryError);
      return new Response(
        JSON.stringify({ success: false, error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!pendingMessages?.length) {
      console.log('[StatusPoll] No pending messages found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending messages to check',
          checked: 0,
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[StatusPoll] Found ${pendingMessages.length} pending messages to check`);
    
    // Mark messages as "pending_no_webhook" if they're too old
    // This is a fallback indicator - the real status should come from webhook
    const results = {
      checked: pendingMessages.length,
      updated: 0,
      errors: 0,
    };
    
    // For now, just mark them with a flag in the metadata
    // In the future, we could poll the NotificaMe API for actual status
    for (const msg of pendingMessages) {
      try {
        const campaignData = msg.mt_campaigns as unknown as { tenant_id: string; channel_id: string };
        
        // Calculate age in minutes
        const ageMinutes = Math.round((Date.now() - new Date(msg.sent_at).getTime()) / 60000);
        
        // If message is very old (> 10 minutes), likely webhook missed
        if (ageMinutes > 10) {
          // Update with a note about missing webhook
          const { error: updateError } = await supabase
            .from('campaign_recipients')
            .update({
              last_error: `Webhook não recebido após ${ageMinutes} minutos`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', msg.id)
            .eq('status', 'sent'); // Only update if still in sent status
          
          if (updateError) {
            console.error(`[StatusPoll] Update error for ${msg.id}:`, updateError);
            results.errors++;
          } else {
            results.updated++;
            console.log(`[StatusPoll] Marked message ${msg.id} as pending (${ageMinutes}min old)`);
          }
        }
      } catch (err) {
        console.error(`[StatusPoll] Error processing ${msg.id}:`, err);
        results.errors++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[StatusPoll] Completed in ${duration}ms - checked: ${results.checked}, updated: ${results.updated}, errors: ${results.errors}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        duration_ms: duration,
        threshold_seconds: ageThresholdSeconds,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[StatusPoll] Unhandled error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
