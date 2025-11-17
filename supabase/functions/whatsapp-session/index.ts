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
    const { action } = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    // Z-API uses instance ID and token in the URL path
    const ZAPI_INSTANCE = Deno.env.get('EVOLUTION_API_URL'); // Reusing this env var for instance ID
    const ZAPI_TOKEN = Deno.env.get('EVOLUTION_API_KEY'); // Reusing this env var for token
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN'); // Security token

    if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Z-API credentials not configured');
    }
    
    const baseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;
    const headers = {
      'Client-Token': ZAPI_CLIENT_TOKEN,
      'Content-Type': 'application/json'
    };
    
    console.log(`Action: ${action} for Z-API instance`);

    if (action === 'initialize') {
      // Check status first
      const statusResponse = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: headers,
      });

      if (!statusResponse.ok) {
        console.error('Error checking status');
        return new Response(
          JSON.stringify({ status: 'disconnected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      console.log('Status data:', JSON.stringify(statusData));
      
      // If already connected, return connected status
      if (statusData.connected === true) {
        return new Response(
          JSON.stringify({
            status: 'connected',
            phoneNumber: statusData.phone || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get QR code image (base64)
      const qrResponse = await fetch(`${baseUrl}/qr-code/image`, {
        method: 'GET',
        headers: headers,
      });

      if (!qrResponse.ok) {
        console.error('Error getting QR code');
        return new Response(
          JSON.stringify({ status: 'disconnected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const qrData = await qrResponse.json();
      
      if (qrData.value) {
        return new Response(
          JSON.stringify({
            status: 'qr',
            qrCode: qrData.value // Z-API returns base64 image in 'value' field
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      const statusResponse = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: headers,
      });

      if (!statusResponse.ok) {
        return new Response(
          JSON.stringify({ status: 'disconnected' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusData = await statusResponse.json();
      console.log('Status check:', JSON.stringify(statusData));
      
      if (statusData.connected === true) {
        return new Response(
          JSON.stringify({
            status: 'connected',
            phoneNumber: statusData.phone || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      const logoutResponse = await fetch(`${baseUrl}/disconnect`, {
        method: 'GET',
        headers: headers,
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
