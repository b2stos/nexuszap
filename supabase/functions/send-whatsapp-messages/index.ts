import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CONFIGURATION: Limit messages per execution to stay under 150s timeout
const MAX_MESSAGES_PER_CALL = 100; // ~80 seconds at 800ms delay
const DELAY_BETWEEN_MESSAGES = 800;
const DELAY_BETWEEN_BATCHES = 2000;
const BATCH_SIZE = 50;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get user's UAZAPI credentials from database
async function getUserCredentials(supabase: any, userId: string): Promise<{ baseUrl: string; token: string } | null> {
  const { data, error } = await supabase
    .from('uazapi_config')
    .select('base_url, instance_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.log('No user UAZAPI config found');
    return null;
  }

  return {
    baseUrl: data.base_url.replace(/\/$/, ''),
    token: data.instance_token
  };
}

// Detect media type from URL
function getMediaType(url: string): 'image' | 'video' | 'audio' | 'document' {
  const urlWithoutQuery = url.split('?')[0];
  const ext = urlWithoutQuery.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  return 'document';
}

// Get MIME type from extension
function getMimeType(url: string): string {
  const urlWithoutQuery = url.split('?')[0];
  const ext = urlWithoutQuery.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'mp4': 'video/mp4',
    'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'webm': 'video/webm',
    '3gp': 'video/3gpp', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
    'ogg': 'audio/ogg', 'm4a': 'audio/mp4', 'aac': 'audio/aac',
    'pdf': 'application/pdf',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Get clean filename from URL
function getCleanFileName(url: string): string {
  const urlWithoutQuery = url.split('?')[0];
  return urlWithoutQuery.split('/').pop() || 'file';
}

// Download media and convert to base64 data URI
async function downloadMediaAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log(`Downloading media from: ${url.substring(0, 80)}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download media: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    const mimeType = getMimeType(url);
    const dataUri = `data:${mimeType};base64,${base64}`;
    
    console.log(`Downloaded ${uint8Array.length} bytes, MIME: ${mimeType}`);
    
    return { base64: dataUri, mimeType };
  } catch (error) {
    console.error(`Error downloading media:`, error);
    return null;
  }
}

// Extract message ID from API response
function extractMessageId(response: any): string | null {
  if (!response) return null;
  
  if (response.messageid) return response.messageid;
  
  if (response.id) {
    const parts = response.id.split(':');
    return parts.length > 1 ? parts[1] : parts[0];
  }
  
  if (response.message?.messageid) return response.message.messageid;
  if (response.data?.messageid) return response.data.messageid;
  
  return null;
}

// MEDIA SENDING - Using /send/media endpoint (UAZAPI docs)
async function tryUAZAPISendMedia(
  baseUrl: string,
  token: string,
  phone: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; response?: any; messageId?: string; error?: string }> {
  const mediaType = getMediaType(mediaUrl);
  const fileName = getCleanFileName(mediaUrl);
  
  console.log(`=== SENDING MEDIA (${mediaType}) ===`);
  console.log(`File: ${fileName}, Caption: ${caption?.substring(0, 50)}...`);

  const headers = {
    'token': token,
    'Content-Type': 'application/json'
  };

  // STRATEGY 1: /send/media with URL (preferred per UAZAPI docs)
  console.log(`[1] Trying /send/media with URL...`);
  try {
    const payload: any = {
      number: phone,
      type: mediaType,
      file: mediaUrl
    };
    
    if (caption) {
      payload.text = caption;
    }
    
    if (mediaType === 'document') {
      payload.docName = fileName;
    }
    
    console.log(`Payload: ${JSON.stringify(payload).substring(0, 200)}...`);
    
    const response = await fetch(`${baseUrl}/send/media`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        if (!data.error) {
          const msgId = extractMessageId(data);
          console.log(`✅ SUCCESS with /send/media (URL), messageId: ${msgId}`);
          return { success: true, response: data, messageId: msgId || undefined };
        }
      } catch {
        if (!responseText.toLowerCase().includes('error')) {
          console.log(`✅ SUCCESS with /send/media (non-JSON)`);
          return { success: true, response: responseText };
        }
      }
    }
  } catch (e) {
    console.error(`Error with /send/media (URL):`, e);
  }

  // STRATEGY 2: /send/media with base64 (fallback)
  console.log(`[2] Trying /send/media with base64...`);
  
  const mediaData = await downloadMediaAsBase64(mediaUrl);
  if (!mediaData) {
    console.log(`Failed to download media for base64`);
    return { success: false, error: 'Failed to download media' };
  }

  try {
    const payload: any = {
      number: phone,
      type: mediaType,
      file: mediaData.base64
    };
    
    if (caption) {
      payload.text = caption;
    }
    
    if (mediaType === 'document') {
      payload.docName = fileName;
    }
    
    const response = await fetch(`${baseUrl}/send/media`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        if (!data.error) {
          const msgId = extractMessageId(data);
          console.log(`✅ SUCCESS with /send/media (base64), messageId: ${msgId}`);
          return { success: true, response: data, messageId: msgId || undefined };
        }
      } catch {
        if (!responseText.toLowerCase().includes('error')) {
          console.log(`✅ SUCCESS with /send/media base64`);
          return { success: true, response: responseText };
        }
      }
    }
  } catch (e) {
    console.error(`Error with /send/media (base64):`, e);
  }

  console.log(`❌ All media attempts failed`);
  return { success: false, error: `Failed to send media via /send/media` };
}

// TEXT MESSAGE SENDING
async function tryUAZAPISend(
  baseUrl: string, 
  token: string, 
  phone: string, 
  message: string
): Promise<{ success: boolean; response?: any; messageId?: string; error?: string }> {
  
  const headers = {
    'token': token,
    'Content-Type': 'application/json'
  };

  console.log(`Sending text to ${phone} via /send/text...`);
  
  try {
    const response = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: phone,
        text: message
      }),
    });
    
    const responseText = await response.text();
    console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        if (!data.error) {
          const msgId = extractMessageId(data);
          console.log(`✅ Text sent successfully, messageId: ${msgId}`);
          return { success: true, response: data, messageId: msgId || undefined };
        }
      } catch {
        if (!responseText.toLowerCase().includes('error')) {
          console.log(`✅ Text sent successfully (non-JSON)`);
          return { success: true, response: responseText };
        }
      }
    }
  } catch (e) {
    console.error(`Error with /send/text:`, e);
  }

  // Fallback: try /chat/send/text
  console.log(`Trying fallback /chat/send/text...`);
  
  try {
    const response = await fetch(`${baseUrl}/chat/send/text`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Phone: phone,
        Body: message
      }),
    });
    
    const responseText = await response.text();
    console.log(`Status: ${response.status}`);
    
    if (response.ok && !responseText.toLowerCase().includes('error')) {
      try {
        const data = JSON.parse(responseText);
        const msgId = extractMessageId(data);
        console.log(`✅ Text sent via /chat/send/text, messageId: ${msgId}`);
        return { success: true, response: data, messageId: msgId || undefined };
      } catch {
        return { success: true, response: responseText };
      }
    }
  } catch (e) {
    console.error(`Error with /chat/send/text:`, e);
  }

  return { success: false, error: `Failed to send message` };
}

// Check if campaign was cancelled
async function checkCancelled(supabase: any, campaignId: string): Promise<boolean> {
  const { data } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();
  
  return data?.status === 'cancelled';
}

// Count remaining pending messages (NOT processing - those are already being handled)
async function countPendingMessages(supabase: any, campaignId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');
  
  return count || 0;
}

// Count processing messages
async function countProcessingMessages(supabase: any, campaignId: string): Promise<number> {
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'processing');
  
  return count || 0;
}

// BACKGROUND TASK: Send messages in batches (limited to MAX_MESSAGES_PER_CALL)
async function sendMessagesInBackground(
  supabase: any,
  campaignId: string,
  messages: any[],
  campaign: any,
  credentials: { baseUrl: string; token: string }
) {
  console.log(`🚀 BACKGROUND TASK STARTED: ${messages.length} messages to process this call`);
  
  let successCount = 0;
  let failCount = 0;
  let cancelled = false;
  
  // Process in batches
  for (let batchStart = 0; batchStart < messages.length; batchStart += BATCH_SIZE) {
    // Check for cancellation at the start of each batch
    if (await checkCancelled(supabase, campaignId)) {
      console.log(`🛑 CAMPAIGN CANCELLED by user`);
      cancelled = true;
      break;
    }
    
    const batch = messages.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(messages.length / BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} messages)`);
    
    for (const message of batch) {
      try {
        const phoneNumber = message.contacts.phone.replace(/\D/g, '');
        console.log(`--- Sending to ${phoneNumber} ---`);

        let messageSent = false;
        let whatsappMessageId: string | null = null;
        const mediaUrls = campaign.media_urls || [];

        // Try to send media if present
        if (mediaUrls.length > 0) {
          for (let i = 0; i < mediaUrls.length; i++) {
            const mediaUrl = mediaUrls[i];
            const caption = i === 0 ? campaign.message_content : undefined;
            
            const mediaResult = await tryUAZAPISendMedia(
              credentials.baseUrl,
              credentials.token,
              phoneNumber,
              mediaUrl,
              caption
            );

            if (mediaResult.success) {
              messageSent = true;
              if (mediaResult.messageId) {
                whatsappMessageId = mediaResult.messageId;
              }
            }
            
            if (i < mediaUrls.length - 1) await sleep(500);
          }
        }

        // If no media sent, send text only
        if (!messageSent) {
          const result = await tryUAZAPISend(
            credentials.baseUrl, 
            credentials.token, 
            phoneNumber, 
            campaign.message_content
          );

          if (!result.success) {
            await supabase
              .from('messages')
              .update({ status: 'failed', error_message: result.error })
              .eq('id', message.id);
            
            failCount++;
            continue;
          }
          
          messageSent = true;
          if (result.messageId) {
            whatsappMessageId = result.messageId;
          }
        }

        // Success - update with whatsapp_message_id
        const updateData: Record<string, any> = { 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        };
        
        if (whatsappMessageId) {
          updateData.whatsapp_message_id = whatsappMessageId;
        }
        
        await supabase
          .from('messages')
          .update(updateData)
          .eq('id', message.id);
        
        successCount++;

        // Delay between messages
        await sleep(DELAY_BETWEEN_MESSAGES);

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
    
    // Log progress after each batch
    console.log(`✅ Batch ${batchNumber} complete: ${successCount} sent, ${failCount} failed`);
    
    // Pause between batches (except for last batch)
    if (batchStart + BATCH_SIZE < messages.length) {
      console.log(`⏸️ Pausing ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  // Check if there are more pending messages
  const remainingPending = await countPendingMessages(supabase, campaignId);
  
  // Determine final status
  let finalStatus: string;
  if (cancelled) {
    finalStatus = 'cancelled';
  } else if (remainingPending > 0) {
    // Still has pending messages - keep as "sending" so frontend can continue
    finalStatus = 'sending';
    console.log(`⏳ ${remainingPending} messages still pending - keeping status as "sending"`);
  } else if (failCount === messages.length) {
    finalStatus = 'failed';
  } else {
    finalStatus = 'completed';
  }

  // Only update completed_at if actually done
  const updateData: Record<string, any> = { status: finalStatus };
  if (finalStatus === 'completed' || finalStatus === 'cancelled' || finalStatus === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }
  
  await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', campaignId);

  console.log(`\n🏁 BATCH FINISHED: ${successCount} sent, ${failCount} failed, remaining: ${remainingPending}, status: ${finalStatus}`);
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    const { data: campaign, error: campaignError } = await userClient
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found or access denied');
    }

    // Try to get user's UAZAPI credentials from database
    let credentials = await getUserCredentials(userClient, user.id);
    
    // Fallback to environment variables if no user config
    if (!credentials) {
      const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
      const UAZAPI_INSTANCE_TOKEN = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

      if (!UAZAPI_BASE_URL || !UAZAPI_INSTANCE_TOKEN) {
        throw new Error('UAZAPI credentials not configured. Configure na página WhatsApp.');
      }

      credentials = {
        baseUrl: UAZAPI_BASE_URL.replace(/\/$/, ''),
        token: UAZAPI_INSTANCE_TOKEN
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log(`=== Starting campaign ${campaignId} ===`);
    console.log(`Base URL: ${credentials.baseUrl}, Resend: ${resend}`);

    if (resend) {
      await supabase
        .from('messages')
        .update({ status: 'pending', error_message: null, sent_at: null, whatsapp_message_id: null })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
    }

    // Update campaign status to sending
    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    // IMPORTANT: Limit to MAX_MESSAGES_PER_CALL to avoid timeout
    // Use FOR UPDATE SKIP LOCKED pattern to prevent race conditions
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(MAX_MESSAGES_PER_CALL);

    if (messagesError) {
      throw new Error('Failed to fetch messages');
    }

    if (!messages || messages.length === 0) {
      // Check if there are any processing messages (from a previous timeout)
      const { count: processingCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'processing');

      if (processingCount && processingCount > 0) {
        // Reset stuck processing messages back to pending (older than 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        await supabase
          .from('messages')
          .update({ status: 'pending', processing_started_at: null })
          .eq('campaign_id', campaignId)
          .eq('status', 'processing')
          .lt('processing_started_at', twoMinutesAgo);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `${processingCount} mensagens estão sendo processadas. Aguarde ou tente novamente em breve.`,
            sent: 0, 
            failed: 0,
            remaining: processingCount,
            needsContinuation: false,
            status: 'processing_in_progress'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No pending messages - mark as completed
      await supabase
        .from('campaigns')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma mensagem pendente para enviar',
          sent: 0, 
          failed: 0,
          remaining: 0,
          needsContinuation: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 CRITICAL: Mark messages as "processing" IMMEDIATELY to prevent race conditions
    const messageIds = messages.map(m => m.id);
    const processingTimestamp = new Date().toISOString();
    
    const { error: lockError } = await supabase
      .from('messages')
      .update({ 
        status: 'processing', 
        processing_started_at: processingTimestamp 
      })
      .in('id', messageIds);

    if (lockError) {
      console.error('Failed to lock messages:', lockError);
      throw new Error('Failed to reserve messages for processing');
    }

    console.log(`🔒 Locked ${messages.length} messages as "processing"`);

    // Get total pending count for response (after locking)
    const totalPending = await countPendingMessages(supabase, campaignId);
    const needsContinuation = totalPending > 0;

    console.log(`📬 Processing ${messages.length} messages, ${totalPending} still pending, ${campaign.media_urls?.length || 0} media files`);
    if (needsContinuation) {
      console.log(`⚠️ Will need continuation - ${totalPending} messages remaining after this batch`);
    }

    // START BACKGROUND TASK - This continues after response is sent!
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      sendMessagesInBackground(supabase, campaignId, messages, campaign, credentials)
    );

    // RESPOND IMMEDIATELY - don't wait for messages to be sent
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: needsContinuation 
          ? `Enviando ${messages.length} de ${totalPending} mensagens. Continuação automática necessária.`
          : `Enviando ${messages.length} mensagens em segundo plano...`,
        total: totalPending,
        processing: messages.length,
        remaining: totalPending - messages.length,
        needsContinuation,
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
