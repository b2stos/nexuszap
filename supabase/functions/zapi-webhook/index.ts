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
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    // Validate webhook payload has required fields
    if (!webhookData || typeof webhookData !== 'object') {
      console.log('Invalid payload: not an object');
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Must have at least event or status field to be a valid Z-API webhook
    if (!webhookData.event && !webhookData.status && !webhookData.messageStatus) {
      console.log('Invalid payload: missing event/status field');
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate phone if present (must be numeric string)
    const phone = webhookData.phone || webhookData.chatId?.split('@')[0];
    if (phone && !/^\d+$/.test(phone.replace(/\D/g, ''))) {
      console.log('Invalid phone number format');
      return new Response(JSON.stringify({ error: 'Invalid phone format' }), {
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

    // Save webhook event to database for monitoring
    const { error: eventError } = await supabase
      .from('webhook_events')
      .insert({
        event_type: webhookData.event || 'status',
        phone: webhookData.phone || webhookData.chatId?.split('@')[0],
        status: webhookData.status || webhookData.messageStatus,
        payload: webhookData,
        processed: false
      });

    if (eventError) {
      console.error('Error saving webhook event:', eventError);
    }

    // Z-API webhook events
    // messageStatus events: SENT, DELIVERED, READ, FAILED
    if (webhookData.event === 'status' || webhookData.status) {
      const phone = webhookData.phone || webhookData.chatId?.split('@')[0];
      const messageStatus = webhookData.status || webhookData.messageStatus;
      
      if (!phone) {
        console.log('No phone number in webhook');
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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
      const updateData: any = {};

      // Map Z-API status to our status
      switch (messageStatus?.toUpperCase()) {
        case 'SENT':
        case 'ENVIADA':
          updateData.status = 'sent';
          updateData.sent_at = new Date().toISOString();
          break;
        case 'DELIVERED':
        case 'ENTREGUE':
          updateData.status = 'delivered';
          updateData.delivered_at = new Date().toISOString();
          break;
        case 'READ':
        case 'LIDA':
          updateData.status = 'read';
          updateData.read_at = new Date().toISOString();
          break;
        case 'FAILED':
        case 'FALHA':
          updateData.status = 'failed';
          updateData.error_message = webhookData.error || 'Message failed';
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
