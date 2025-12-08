import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    // Get credentials
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Z-API credentials not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    // Create user client to verify ownership (uses RLS)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the authenticated user owns this campaign
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    // Check campaign ownership via RLS-protected query
    const { data: campaign, error: campaignError } = await userClient
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.log(`Campaign ${campaignId} not found or access denied for user ${user.id}`);
      throw new Error('Campaign not found or access denied');
    }

    // Now use service role for updates
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const zapiBaseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
    const zapiHeaders = {
      'Client-Token': ZAPI_CLIENT_TOKEN,
      'Content-Type': 'application/json'
    };
    
    console.log(`User ${user.id} sending campaign ${campaignId} via Z-API`);

    // Update campaign status to sending
    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // Get pending messages for this campaign
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (messagesError) {
      throw new Error('Failed to fetch messages');
    }

    console.log(`Found ${messages.length} messages to send`);

    let successCount = 0;
    let failCount = 0;

    // Send messages with delay between each (to avoid rate limiting)
    for (const message of messages) {
      try {
        const phoneNumber = message.contacts.phone.replace(/\D/g, '');
        
        console.log(`Sending to ${phoneNumber}`);

        // Send text message via Z-API
        const messagePayload = {
          phone: phoneNumber,
          message: campaign.message_content,
        };

        const sendResponse = await fetch(`${zapiBaseUrl}/send-text`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify(messagePayload),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          console.error(`Failed to send to ${phoneNumber}:`, errorText);
          
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: `Z-API error: ${sendResponse.status} - ${errorText}`
            })
            .eq('id', message.id);
          
          failCount++;
        } else {
          const responseData = await sendResponse.json();
          console.log(`Message sent to ${phoneNumber}:`, responseData);
          
          await supabase
            .from('messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          successCount++;
        }

        // Add delay between messages (1 second) to avoid rate limiting
        if (messages.indexOf(message) < messages.length - 1) {
          await sleep(1000);
        }

      } catch (error) {
        console.error(`Error sending message ${message.id}:`, error);
        
        await supabase
          .from('messages')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', message.id);
        
        failCount++;
      }
    }

    // Update campaign status
    const finalStatus = failCount === messages.length ? 'failed' : 'completed';
    await supabase
      .from('campaigns')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log(`Campaign completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: messages.length,
        sent: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('access denied') ? 403 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
