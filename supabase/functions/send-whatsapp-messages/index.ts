import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Detect media type from URL
function getMediaType(url: string): 'image' | 'video' | 'audio' | 'document' {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  return 'document';
}

// Function to send media via UAZAPI
async function tryUAZAPISendMedia(
  baseUrl: string,
  token: string,
  phone: string,
  mediaUrl: string,
  caption?: string,
  instanceName?: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  const mediaType = getMediaType(mediaUrl);
  console.log(`Sending ${mediaType}: ${mediaUrl}`);

  const numberFormats = [
    phone,
    `${phone}@s.whatsapp.net`,
    `${phone}@c.us`,
  ];

  const headerSets = [
    { key: 'token', value: token },
    { key: 'Token', value: token },
    { key: 'apikey', value: token },
  ];

  // Endpoint patterns for media - UAZAPI style
  const getMediaEndpoints = (type: string, instance?: string) => {
    const endpoints = [];
    
    // UAZAPI/Wuzapi standard endpoints for media
    if (type === 'image') {
      endpoints.push(
        { path: '/chat/send/image', bodyFn: (num: string) => ({ Phone: num, Image: mediaUrl, Caption: caption || '' }) },
        { path: '/chat/send/image', bodyFn: (num: string) => ({ Phone: num, Url: mediaUrl, Caption: caption || '' }) },
        { path: '/message/sendMedia', bodyFn: (num: string) => ({ number: num, mediatype: 'image', media: mediaUrl, caption: caption || '' }) },
      );
    } else if (type === 'video') {
      endpoints.push(
        { path: '/chat/send/video', bodyFn: (num: string) => ({ Phone: num, Video: mediaUrl, Caption: caption || '' }) },
        { path: '/message/sendMedia', bodyFn: (num: string) => ({ number: num, mediatype: 'video', media: mediaUrl, caption: caption || '' }) },
      );
    } else if (type === 'audio') {
      endpoints.push(
        { path: '/chat/send/audio', bodyFn: (num: string) => ({ Phone: num, Audio: mediaUrl }) },
        { path: '/message/sendMedia', bodyFn: (num: string) => ({ number: num, mediatype: 'audio', media: mediaUrl }) },
      );
    } else {
      endpoints.push(
        { path: '/chat/send/document', bodyFn: (num: string) => ({ Phone: num, Document: mediaUrl, FileName: mediaUrl.split('/').pop() || 'document', Caption: caption || '' }) },
        { path: '/message/sendMedia', bodyFn: (num: string) => ({ number: num, mediatype: 'document', media: mediaUrl, caption: caption || '' }) },
      );
    }

    // Evolution API style with instance
    if (instance) {
      endpoints.push(
        { path: `/message/sendMedia/${instance}`, bodyFn: (num: string) => ({ number: num, mediatype: type, media: mediaUrl, caption: caption || '' }) },
      );
    }

    return endpoints;
  };

  const endpoints = getMediaEndpoints(mediaType, instanceName);
  let attempts = 0;
  const maxAttempts = 10;

  for (const headerSet of headerSets) {
    const headers: Record<string, string> = {
      [headerSet.key]: headerSet.value,
      'Content-Type': 'application/json'
    };

    for (const numberFormat of numberFormats) {
      for (const endpoint of endpoints) {
        if (attempts >= maxAttempts) {
          return { success: false, error: `Falha ao enviar mídia após ${attempts} tentativas.` };
        }

        const url = `${baseUrl}${endpoint.path}`;
        const body = endpoint.bodyFn(numberFormat);

        console.log(`[Media ${++attempts}] Trying: ${url}`);
        console.log(`Body: ${JSON.stringify(body)}`);

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
          });

          const responseText = await response.text();
          console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 300)}`);

          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              if (!data.error && !data.message?.toLowerCase().includes('not allowed')) {
                console.log(`SUCCESS media with: ${url}`);
                return { success: true, response: data };
              }
            } catch {
              if (!responseText.toLowerCase().includes('error')) {
                return { success: true, response: responseText };
              }
            }
          }

          if (response.status === 404) break;
        } catch (fetchError) {
          console.error(`Fetch error for ${url}:`, fetchError);
        }
      }
    }
  }

  return { success: false, error: `Falha ao enviar mídia após ${attempts} tentativas.` };
}

// Get instance info first to know the instance name/id
async function getInstanceInfo(baseUrl: string, token: string): Promise<{ instanceName?: string; instanceId?: string }> {
  console.log('Fetching instance info...');
  
  const headerSets = [
    { key: 'token', value: token },
    { key: 'apikey', value: token },
    { key: 'Authorization', value: `Bearer ${token}` },
  ];
  
  for (const headerSet of headerSets) {
    const headers: Record<string, string> = { 
      [headerSet.key]: headerSet.value, 
      'Content-Type': 'application/json' 
    };
    try {
      const response = await fetch(`${baseUrl}/instance/status`, {
        method: 'GET',
        headers: headers,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Instance info response:', JSON.stringify(data));
        return {
          instanceName: data.instance?.name || data.instance?.systemName || data.instanceName,
          instanceId: data.instance?.id || data.instanceId
        };
      }
    } catch (e) {
      console.error('Error getting instance info with headers:', Object.keys(headers), e);
    }
  }
  
  // Try fetchInstances endpoint
  try {
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': token },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('FetchInstances response:', JSON.stringify(data));
      if (Array.isArray(data) && data.length > 0) {
        return {
          instanceName: data[0].instance?.instanceName || data[0].instanceName,
          instanceId: data[0].instance?.instanceId || data[0].instanceId
        };
      }
    }
  } catch (e) {
    console.error('Error fetching instances:', e);
  }
  
  return {};
}

// Function to try sending message with different endpoint/format combinations
async function tryUAZAPISend(
  baseUrl: string, 
  token: string, 
  phone: string, 
  message: string,
  instanceName?: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  
  // Different number formats to try - prioritize raw number first
  const numberFormats = [
    phone,                          // Just numbers: 5511947892299
    `${phone}@s.whatsapp.net`,     // WhatsApp internal format
    `${phone}@c.us`,               // WhatsApp contact format
  ];
  
  // Header combinations - uazapi uses lowercase 'token'
  const headerSets = [
    { key: 'token', value: token },
    { key: 'Token', value: token },
    { key: 'apikey', value: token },
  ];
  
  // Endpoint patterns - PRIORITIZE /chat/send/text (uazapi/wuzapi standard)
  const getEndpoints = (instance?: string) => {
    const endpoints = [];
    
    // UAZAPI/Wuzapi standard endpoint - PRIORITIZE THIS
    endpoints.push(
      { path: '/chat/send/text', bodyFn: (num: string) => ({ Phone: num, Body: message }) },
    );
    
    // Evolution API style with instance
    if (instance) {
      endpoints.push(
        { path: `/message/sendText/${instance}`, bodyFn: (num: string) => ({ number: num, text: message }) },
        { path: `/message/sendText/${instance}`, bodyFn: (num: string) => ({ number: num, textMessage: { text: message } }) },
      );
    }
    
    // Other common endpoints
    endpoints.push(
      { path: '/message/sendText', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/send/text', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/sendText', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/message/text', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/send-message', bodyFn: (num: string) => ({ chatId: num, text: message }) },
    );
    
    return endpoints;
  };

  const endpoints = getEndpoints(instanceName);
  
  // Try each combination (limit attempts to avoid timeout)
  let attempts = 0;
  const maxAttempts = 15;
  
  for (const headerSet of headerSets) {
    const headers: Record<string, string> = { 
      [headerSet.key]: headerSet.value, 
      'Content-Type': 'application/json' 
    };
    
    for (const numberFormat of numberFormats) {
      for (const endpoint of endpoints) {
        if (attempts >= maxAttempts) {
          console.log(`Reached max attempts (${maxAttempts}), stopping...`);
          return { 
            success: false, 
            error: `Nenhum endpoint funcionou após ${attempts} tentativas.` 
          };
        }
        
        const url = `${baseUrl}${endpoint.path}`;
        const body = endpoint.bodyFn(numberFormat);
        
        console.log(`[${++attempts}] Trying: ${url}`);
        console.log(`Headers: ${JSON.stringify(Object.keys(headers))}`);
        console.log(`Body: ${JSON.stringify(body)}`);
        
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
          });
          
          const responseText = await response.text();
          console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 300)}`);
          
          // Check if successful (status 200-299)
          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              // Check if response indicates success (not an error)
              if (!data.error && !data.message?.toLowerCase().includes('not allowed') && !data.message?.toLowerCase().includes('not found')) {
                console.log(`SUCCESS with: ${url}`);
                return { success: true, response: data };
              }
            } catch {
              // Response wasn't JSON but was 200 OK - might still be success
              if (!responseText.toLowerCase().includes('error') && !responseText.toLowerCase().includes('not allowed')) {
                console.log(`SUCCESS (non-JSON) with: ${url}`);
                return { success: true, response: responseText };
              }
            }
          }
          
          // If 404, the endpoint doesn't exist - skip other variations
          if (response.status === 404) {
            console.log(`404 - endpoint doesn't exist, trying next...`);
            break;
          }
          
        } catch (fetchError) {
          console.error(`Fetch error for ${url}:`, fetchError);
        }
      }
    }
  }
  
  return { 
    success: false, 
    error: `Nenhum endpoint funcionou após ${attempts} tentativas. Verifique as configurações da UAZAPI.` 
  };
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
    
    console.log(`=== User ${user.id} sending campaign ${campaignId} via UAZAPI ===`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Resend mode: ${resend}`);

    // Get instance info first
    const instanceInfo = await getInstanceInfo(baseUrl, UAZAPI_INSTANCE_TOKEN);
    console.log(`Instance info: ${JSON.stringify(instanceInfo)}`);

    // If resend is true, reset failed messages to pending first
    if (resend) {
      console.log('Resending: Resetting failed messages to pending...');
      const { error: resetError } = await supabase
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
        console.log('Reset failed messages to pending');
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
    console.log(`Campaign has ${campaign.media_urls?.length || 0} media files`);

    let successCount = 0;
    let failCount = 0;

    // Send messages with delay between each (to avoid rate limiting)
    for (const message of messages) {
      try {
        const phoneNumber = message.contacts.phone.replace(/\D/g, '');
        
        console.log(`\n--- Sending to ${phoneNumber} ---`);

        let mediaSuccess = true;
        const mediaUrls = campaign.media_urls || [];

        // Send media first (if any)
        if (mediaUrls.length > 0) {
          for (let i = 0; i < mediaUrls.length; i++) {
            const mediaUrl = mediaUrls[i];
            // First media gets the caption (message_content), others don't
            const caption = i === 0 ? campaign.message_content : undefined;
            
            console.log(`Sending media ${i + 1}/${mediaUrls.length}: ${mediaUrl}`);
            
            const mediaResult = await tryUAZAPISendMedia(
              baseUrl,
              UAZAPI_INSTANCE_TOKEN,
              phoneNumber,
              mediaUrl,
              caption,
              instanceInfo.instanceName
            );

            if (!mediaResult.success) {
              console.error(`Failed to send media to ${phoneNumber}:`, mediaResult.error);
              mediaSuccess = false;
              break;
            }
            
            // Small delay between media files
            if (i < mediaUrls.length - 1) {
              await sleep(500);
            }
          }
        }

        // If no media or media failed, send text message
        // If media was sent with caption, no need to send text again
        if (!mediaSuccess || mediaUrls.length === 0) {
          const result = await tryUAZAPISend(
            baseUrl, 
            UAZAPI_INSTANCE_TOKEN, 
            phoneNumber, 
            campaign.message_content,
            instanceInfo.instanceName
          );

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
            continue;
          }
        }

        // Success - either media with caption was sent, or text was sent
        console.log(`Message sent successfully to ${phoneNumber}`);
        
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        successCount++;

        // Add delay between messages (1.5 seconds) to avoid rate limiting
        if (messages.indexOf(message) < messages.length - 1) {
          await sleep(1500);
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

    console.log(`\n=== Campaign completed: ${successCount} sent, ${failCount} failed ===`);

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
