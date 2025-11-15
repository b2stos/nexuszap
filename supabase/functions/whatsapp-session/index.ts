import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName } = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error('Evolution API credentials not configured');
    }

    const instance = instanceName || 'whatsapp-business';
    
    console.log(`Action: ${action} for instance: ${instance}`);

    if (action === 'initialize') {
      // Create/fetch instance and get QR code
      const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Error creating instance:', errorText);
        throw new Error(`Failed to create instance: ${createResponse.status}`);
      }

      const instanceData = await createResponse.json();
      
      // Connect instance
      const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (!connectResponse.ok) {
        const errorText = await connectResponse.text();
        console.error('Error connecting instance:', errorText);
      }

      const connectData = await connectResponse.json();
      
      if (connectData.qrcode?.code) {
        return new Response(
          JSON.stringify({
            status: 'qr',
            qrCode: connectData.qrcode.code
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          status: 'connected',
          phoneNumber: connectData.instance?.owner || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instance}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (!statusResponse.ok) {
        return new Response(
          JSON.stringify({ status: 'disconnected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      
      if (statusData.state === 'open') {
        return new Response(
          JSON.stringify({
            status: 'connected',
            phoneNumber: statusData.instance?.owner || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If not connected, try to get QR code
      const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (connectResponse.ok) {
        const connectData = await connectResponse.json();
        if (connectData.qrcode?.code) {
          return new Response(
            JSON.stringify({
              status: 'qr',
              qrCode: connectData.qrcode.code
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      const logoutResponse = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
      });

      if (!logoutResponse.ok) {
        console.error('Error disconnecting instance');
      }

      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Error in whatsapp-session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
