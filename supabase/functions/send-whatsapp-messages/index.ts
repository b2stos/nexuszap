import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to try sending message with different endpoint/format combinations
async function tryUAZAPISend(
  baseUrl: string, 
  token: string, 
  phone: string, 
  message: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  
  // Different number formats to try
  const numberFormats = [
    phone,                          // Just numbers: 5511947892299
    `${phone}@c.us`,               // WhatsApp contact: 5511947892299@c.us
    `${phone}@s.whatsapp.net`,     // Alternative format
  ];
  
  // Different endpoint/body combinations to try
  const endpoints = [
    { 
      path: '/message/sendText', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/message/text', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/sendText', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/chat/send/text', 
      bodyFn: (num: string) => ({ Phone: num, Body: message })
    },
    { 
      path: '/send-message', 
      bodyFn: (num: string) => ({ chatId: num, contentType: 'string', content: message })
    },
    { 
      path: '/message/send', 
      bodyFn: (num: string) => ({ to: num, type: 'text', text: { body: message } })
    },
  ];

  // Try each combination
  for (const numberFormat of numberFormats) {
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint.path}`;
      const body = endpoint.bodyFn(numberFormat);
      
      console.log(`Trying: ${url} with number: ${numberFormat}`);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": token,
          },
          body: JSON.stringify(body),
        });
        
        const responseText = await response.text();
        console.log(`Status: ${response.status}`);
        
        // Check if successful
        if (response.ok) {
          try {
            const data = JSON.parse(responseText);
            if (!data.error && !data.message?.includes('Not Allowed') && !data.message?.includes('not found')) {
              console.log(`SUCCESS with: ${url} and number format: ${numberFormat}`);
              return { success: true, response: data };
            }
          } catch {
            if (!responseText.includes('error') && !responseText.includes('Not Allowed')) {
              return { success: true, response: responseText };
            }
          }
        }
        
        if (response.status >= 400 && response.status < 500) {
          continue;
        }
        
      } catch (fetchError) {
        console.error(`Fetch error for ${url}:`, fetchError);
        continue;
      }
    }
  }
  
  return { success: false, error: "Nenhum endpoint funcionou" };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, resend = false } = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    // Get credentials
    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const UAZAPI_INSTANCE_TOKEN = Deno.env.get('UAZAPI_INSTANCE_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!UAZAPI_BASE_URL || !UAZAPI_INSTANCE_TOKEN) {
      throw new Error('UAZAPI credentials not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, '');

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
    
    console.log(`User ${user.id} sending campaign ${campaignId} via UAZAPI (resend: ${resend})`);

    // If resend is true, reset failed messages to pending first
    if (resend) {
      console.log('Resending: Resetting failed messages to pending...');
      const { data: resetData, error: resetError } = await supabase
        .from('messages')
        .update({ 
          status: 'pending', 
          error_message: null,
          sent_at: null 
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
      
      if (resetError) {
        console.error('Error resetting failed messages:', resetError);
      } else {
        console.log(`Reset messages for resend`);
      }
    }

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

        // Try sending with multiple endpoint/format combinations
        const result = await tryUAZAPISend(baseUrl, UAZAPI_INSTANCE_TOKEN, phoneNumber, campaign.message_content);

        if (!result.success) {
          console.error(`Failed to send to ${phoneNumber}:`, result.error);
          
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              error_message: result.error || 'UAZAPI error'
            })
            .eq('id', message.id);
          
          failCount++;
        } else {
          console.log(`Message sent to ${phoneNumber}`);
          
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
