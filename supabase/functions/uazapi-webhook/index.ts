import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Validate webhook secret for security
function validateWebhookSecret(req: Request): boolean {
  const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
  
  // If no secret is configured, log warning but allow (for backward compatibility during setup)
  if (!WEBHOOK_SECRET) {
    console.warn('⚠️ WEBHOOK_SECRET not configured - webhook validation skipped');
    return true;
  }
  
  const providedSecret = req.headers.get('x-webhook-secret');
  
  if (!providedSecret) {
    console.error('❌ Missing x-webhook-secret header');
    return false;
  }
  
  if (providedSecret !== WEBHOOK_SECRET) {
    console.error('❌ Invalid webhook secret provided');
    return false;
  }
  
  return true;
}

// Validate payload structure to prevent injection
function validatePayload(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const payload = data as Record<string, unknown>;
  
  // Must have at least EventType or event
  if (!payload.EventType && !payload.event && !payload.type) {
    console.error('❌ Invalid payload: missing required fields');
    return false;
  }
  
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Validate webhook secret
    if (!validateWebhookSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid webhook secret' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const webhookData = await req.json();
    
    // Security: Validate payload structure
    if (!validatePayload(webhookData)) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: Invalid payload structure' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('=== BASE360 WEBHOOK RECEIVED ===');
    console.log('EventType:', webhookData.EventType);
    console.log('State:', webhookData.state);
    console.log('Type:', webhookData.type);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract Base360 specific fields with type safety
    const eventType = String(webhookData.EventType || 'unknown').slice(0, 100);
    const state = webhookData.state as string | undefined;
    const type = webhookData.type as string | undefined;
    const chat = webhookData.chat as Record<string, unknown> | undefined;
    const message = webhookData.message as Record<string, unknown> | undefined;
    const event = webhookData.event as Record<string, unknown> | undefined;

    // Extract phone number from Base360 format (sanitize to digits only)
    let phone: string | null = null;
    const chatWaId = chat?.wa_chatid;
    const chatPhone = chat?.phone;
    const eventChat = event?.Chat;
    
    if (typeof chatWaId === 'string') {
      phone = chatWaId.split('@')[0].replace(/\D/g, '').slice(0, 20);
    } else if (typeof chatPhone === 'string') {
      phone = chatPhone.replace(/\D/g, '').slice(0, 20);
    } else if (typeof eventChat === 'string') {
      phone = eventChat.split('@')[0].replace(/\D/g, '').slice(0, 20);
    }

    // Extract message ID for correlation (sanitize)
    let messageId: string | null = null;
    const msgId = message?.messageid;
    const msgIdAlt = message?.id;
    const eventMsgIds = event?.MessageIDs;
    
    if (typeof msgId === 'string') {
      messageId = msgId.slice(0, 100);
    } else if (typeof msgIdAlt === 'string') {
      const parts = msgIdAlt.split(':');
      messageId = (parts.length > 1 ? parts[1] : parts[0]).slice(0, 100);
    } else if (Array.isArray(eventMsgIds) && eventMsgIds.length > 0) {
      messageId = String(eventMsgIds[0]).slice(0, 100);
    }

    console.log('Extracted phone:', phone);
    console.log('Extracted messageId:', messageId);
    console.log('State:', state);

    // Determine status from Base360 state
    let status: string | null = null;
    const stateUpper = typeof state === 'string' ? state.toUpperCase() : '';
    const eventTypeVal = event?.Type;
    const eventTypeUpper = typeof eventTypeVal === 'string' ? eventTypeVal.toUpperCase() : '';
    
    if (stateUpper === 'DELIVERED' || eventTypeUpper === 'DELIVERED') {
      status = 'delivered';
    } else if (stateUpper === 'READ' || eventTypeUpper === 'READ') {
      status = 'read';
    } else if (stateUpper === 'SENT' || eventTypeUpper === 'SENT') {
      status = 'sent';
    } else if (stateUpper === 'ERROR' || stateUpper === 'FAILED') {
      status = 'failed';
    }

    // Save webhook event to database for monitoring
    const { error: eventError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: eventType,
        phone: phone,
        status: status || (typeof state === 'string' ? state.slice(0, 50) : 'unknown'),
        payload: webhookData,
        processed: false
      });

    if (eventError) {
      console.error('Error saving webhook event:', eventError);
    }

    // Only process status updates
    if (status && (eventType === 'messages_update' || type === 'ReadReceipt')) {
      console.log(`Processing status update: ${status}`);

      let foundMessage = null;

      // Strategy 1: Find by whatsapp_message_id (most reliable)
      if (messageId) {
        console.log('Searching by whatsapp_message_id:', messageId);
        const { data: messages, error: findError } = await supabase
          .from('messages')
          .select('*')
          .eq('whatsapp_message_id', messageId)
          .limit(1);

        if (!findError && messages && messages.length > 0) {
          foundMessage = messages[0];
          console.log('Found message by whatsapp_message_id:', foundMessage.id);
        }
      }

      // Strategy 2: Find by phone number in contacts (fallback)
      if (!foundMessage && phone) {
        console.log('Searching by phone:', phone);
        
        // Find contact by phone
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`phone.eq.${phone},phone.like.%${phone.slice(-8)}%`)
          .limit(5);

        if (contacts && contacts.length > 0) {
          const contactIds = contacts.map(c => c.id);
          console.log('Found contacts:', contactIds);

          // Find most recent message for these contacts
          const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .in('contact_id', contactIds)
            .in('status', ['pending', 'sent', 'delivered'])
            .order('created_at', { ascending: false })
            .limit(1);

          if (messages && messages.length > 0) {
            foundMessage = messages[0];
            console.log('Found message by phone:', foundMessage.id);
          }
        }
      }

      if (foundMessage) {
        const updateData: Record<string, unknown> = { status };

        if (status === 'sent') {
          updateData.sent_at = new Date().toISOString();
        } else if (status === 'delivered') {
          updateData.delivered_at = new Date().toISOString();
        } else if (status === 'read') {
          updateData.read_at = new Date().toISOString();
        }

        // Update if new status is "higher" than current
        const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
        const currentOrder = statusOrder[foundMessage.status as keyof typeof statusOrder] || 0;
        const newOrder = statusOrder[status as keyof typeof statusOrder] || 0;

        if (newOrder > currentOrder || status === 'failed') {
          const { error: updateError } = await supabase
            .from('messages')
            .update(updateData)
            .eq('id', foundMessage.id);

          if (updateError) {
            console.error('Error updating message:', updateError);
          } else {
            console.log(`✅ Message ${foundMessage.id} updated to ${status}`);

            // Mark webhook event as processed
            await supabase
              .from('webhook_events')
              .update({ 
                message_id: foundMessage.id,
                processed: true 
              })
              .eq('phone', phone)
              .is('processed', false)
              .order('created_at', { ascending: false })
              .limit(1);
          }
        } else {
          console.log(`Skipping update: current ${foundMessage.status} >= new ${status}`);
        }
      } else {
        console.log('No message found for webhook event');
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});