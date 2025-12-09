import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    
    console.log(`=== Sending campaign ${campaignId} ===`);
    console.log(`Base URL: ${credentials.baseUrl}, Resend: ${resend}`);

    if (resend) {
      await supabase
        .from('messages')
        .update({ status: 'pending', error_message: null, sent_at: null, whatsapp_message_id: null })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');
    }

    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (messagesError) {
      throw new Error('Failed to fetch messages');
    }

    console.log(`${messages.length} messages to send, ${campaign.media_urls?.length || 0} media files`);

    let successCount = 0;
    let failCount = 0;

    for (const message of messages) {
      try {
        const phoneNumber = message.contacts.phone.replace(/\D/g, '');
        console.log(`\n--- Sending to ${phoneNumber} ---`);

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
              console.log(`Media ${i + 1} sent with caption`);
            } else {
              console.log(`Media ${i + 1} failed: ${mediaResult.error}`);
            }
            
            if (i < mediaUrls.length - 1) await sleep(500);
          }
        }

        // If no media sent, send text only
        if (!messageSent) {
          console.log(`Sending text-only message...`);
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

        // Success - update with whatsapp_message_id for webhook correlation
        const updateData: Record<string, any> = { 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        };
        
        if (whatsappMessageId) {
          updateData.whatsapp_message_id = whatsappMessageId;
          console.log(`Saved whatsapp_message_id: ${whatsappMessageId}`);
        }
        
        await supabase
          .from('messages')
          .update(updateData)
          .eq('id', message.id);
        
        successCount++;

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

    const finalStatus = failCount === messages.length ? 'failed' : 'completed';
    await supabase
      .from('campaigns')
      .update({ status: finalStatus, completed_at: new Date().toISOString() })
      .eq('id', campaignId);

    console.log(`\n=== Campaign done: ${successCount} sent, ${failCount} failed ===`);

    return new Response(
      JSON.stringify({ success: true, total: messages.length, sent: successCount, failed: failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});