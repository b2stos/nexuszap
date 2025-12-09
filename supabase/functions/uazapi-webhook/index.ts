import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
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

    // Extract Base360 specific fields
    const eventType = webhookData.EventType || 'unknown';
    const state = webhookData.state; // "Delivered", "Read", "Sent", etc
    const type = webhookData.type; // "ReadReceipt", etc
    const chat = webhookData.chat;
    const message = webhookData.message;
    const event = webhookData.event;

    // Extract phone number from Base360 format
    let phone: string | null = null;
    if (chat?.wa_chatid) {
      // Format: "5511989404212@s.whatsapp.net" -> "5511989404212"
      phone = chat.wa_chatid.split('@')[0];
    } else if (chat?.phone) {
      // Format: "+55 11 98940-4212" -> "5511989404212"
      phone = chat.phone.replace(/\D/g, '');
    } else if (event?.Chat) {
      // For messages_update events: "214220218081350@lid" 
      // Need to get from chat object instead
      phone = event.Chat.split('@')[0];
    }

    // Extract message ID for correlation
    let messageId: string | null = null;
    if (message?.messageid) {
      messageId = message.messageid;
    } else if (message?.id) {
      // Format: "5511913185456:3EB0A7F1340EA7803FC9BE" -> "3EB0A7F1340EA7803FC9BE"
      const parts = message.id.split(':');
      messageId = parts.length > 1 ? parts[1] : parts[0];
    } else if (event?.MessageIDs && event.MessageIDs.length > 0) {
      messageId = event.MessageIDs[0];
    }

    console.log('Extracted phone:', phone);
    console.log('Extracted messageId:', messageId);
    console.log('State:', state);

    // Determine status from Base360 state
    let status: string | null = null;
    const stateUpper = state?.toUpperCase() || '';
    const eventTypeUpper = event?.Type?.toUpperCase() || '';
    
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
        status: status || state,
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
