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
    console.log('UAZAPI Webhook received:', JSON.stringify(webhookData, null, 2));

    // Validate webhook payload
    if (!webhookData || typeof webhookData !== 'object') {
      console.log('Invalid payload: not an object');
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // UAZAPI webhook event structure
    // Events: messages.upsert, connection.update, qrcode.updated, messages.update
    const event = webhookData.event || 'unknown';
    const instance = webhookData.instance || webhookData.instanceName;
    const data = webhookData.data || webhookData;

    // Extract phone number from different UAZAPI event formats
    let phone = null;
    if (data.key?.remoteJid) {
      phone = data.key.remoteJid.split('@')[0];
    } else if (data.remoteJid) {
      phone = data.remoteJid.split('@')[0];
    } else if (data.from) {
      phone = data.from.split('@')[0];
    } else if (data.phone) {
      phone = data.phone;
    }

    // Save webhook event to database for monitoring
    const { error: eventError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: event,
        phone: phone,
        status: data.status || data.messageStatus || null,
        payload: webhookData,
        processed: false
      });

    if (eventError) {
      console.error('Error saving webhook event:', eventError);
    }

    // Handle message status updates
    if (event === 'messages.update' || event === 'message.update' || data.status) {
      if (!phone) {
        console.log('No phone number in webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // UAZAPI status values: PENDING, SENT, DELIVERY_ACK (delivered), READ, PLAYED
      const messageStatus = data.status || data.update?.status;
      
      console.log(`Status update for ${phone}: ${messageStatus}`);

      // Find message by phone number
      const { data: messages, error: findError } = await supabase
        .from('messages')
        .select('*, contacts(*)')
        .eq('contacts.phone', phone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (findError || !messages || messages.length === 0) {
        console.log('Message not found for phone:', phone);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const message = messages[0];
      const updateData: Record<string, unknown> = {};

      // Map UAZAPI status to our status
      switch (messageStatus?.toUpperCase()) {
        case 'PENDING':
          updateData.status = 'pending';
          break;
        case 'SENT':
        case 'SERVER_ACK':
          updateData.status = 'sent';
          updateData.sent_at = new Date().toISOString();
          break;
        case 'DELIVERY_ACK':
        case 'DELIVERED':
          updateData.status = 'delivered';
          updateData.delivered_at = new Date().toISOString();
          break;
        case 'READ':
        case 'PLAYED':
          updateData.status = 'read';
          updateData.read_at = new Date().toISOString();
          break;
        case 'ERROR':
        case 'FAILED':
          updateData.status = 'failed';
          updateData.error_message = data.error || 'Message failed';
          break;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', message.id);

        if (updateError) {
          console.error('Error updating message:', updateError);
        } else {
          console.log(`Message ${message.id} updated:`, updateData);
          
          // Update webhook event with message_id and mark as processed
          await supabase
            .from('webhook_events')
            .update({ 
              message_id: message.id,
              processed: true 
            })
            .eq('phone', phone)
            .is('processed', false)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      }
    }

    // Handle connection updates
    if (event === 'connection.update') {
      console.log('Connection update:', data.state || data.status);
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
