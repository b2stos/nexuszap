import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory session storage (in production, use a database)
const sessions = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    
    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Unauthorized');
    }

    // For demo purposes, we'll simulate a WhatsApp Web session
    // In production, integrate with Evolution API or similar WhatsApp Business API
    
    console.log(`Action: ${action}`);

    if (action === 'initialize') {
      // Generate a mock QR code data (in production, this would come from WhatsApp API)
      const qrCode = `2@${Math.random().toString(36).substring(7)},${Date.now()}`;
      
      sessions.set('current', {
        status: 'qr',
        qrCode,
        timestamp: Date.now()
      });

      return new Response(
        JSON.stringify({
          status: 'qr',
          qrCode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      const session = sessions.get('current') || { status: 'disconnected' };
      
      // Simulate successful connection after 10 seconds
      if (session.status === 'qr' && Date.now() - session.timestamp > 10000) {
        const connectedSession = {
          status: 'connected',
          phoneNumber: '+55 11 98765-4321',
          timestamp: Date.now()
        };
        sessions.set('current', connectedSession);
        return new Response(
          JSON.stringify(connectedSession),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(session),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      sessions.delete('current');
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
