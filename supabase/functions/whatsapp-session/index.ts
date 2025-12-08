import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    console.log(`Retry attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES} after ${delay}ms`);
    await sleep(delay);
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

// Parse UAZAPI response to check connection status
function parseConnectionStatus(data: any): { connected: boolean; phoneNumber: string | null; profileName: string | null } {
  // UAZAPI response structure:
  // { instance: { status: "connected", owner: "5511...", profileName: "..." }, status: { connected: true, loggedIn: true } }
  
  const instanceStatus = data.instance?.status;
  const statusConnected = data.status?.connected;
  const statusLoggedIn = data.status?.loggedIn;
  
  const isConnected = instanceStatus === 'connected' || statusConnected === true || statusLoggedIn === true;
  const phoneNumber = data.instance?.owner || data.status?.jid?.split('@')[0]?.split(':')[0] || null;
  const profileName = data.instance?.profileName || null;
  
  return { connected: isConnected, phoneNumber, profileName };
}

async function testUAZAPI(baseUrl: string, instanceToken: string) {
  try {
    console.log('Testing UAZAPI connection:', baseUrl);
    
    const response = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Test response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('UAZAPI test failed:', errorText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('UAZAPI test exception:', error);
    return false;
  }
}

async function initializeUAZAPI(baseUrl: string, instanceToken: string) {
  console.log('Initializing UAZAPI connection');
  
  return await retryWithBackoff(async () => {
    // Check current status
    const statusResponse = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    console.log('Status response:', statusResponse.status);

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('UAZAPI status:', JSON.stringify(statusData));
      
      const { connected, phoneNumber, profileName } = parseConnectionStatus(statusData);
      
      if (connected) {
        return {
          status: 'connected',
          phoneNumber: phoneNumber,
          profileName: profileName,
          provider: 'UAZAPI'
        };
      }
      
      // Check if there's a QR code in the response
      const qrCode = statusData.instance?.qrcode || statusData.qrcode;
      if (qrCode && qrCode.length > 10) {
        return {
          status: 'qr',
          qrCode: qrCode,
          provider: 'UAZAPI'
        };
      }
    }

    // Get QR code if not connected
    console.log('Requesting QR code from UAZAPI');
    const qrResponse = await fetch(`${baseUrl}/instance/qrcode`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    console.log('QR response status:', qrResponse.status);

    if (qrResponse.ok) {
      const qrData = await qrResponse.json();
      const qrCode = qrData.qrcode || qrData.base64 || qrData.code || qrData.qr;
      
      if (qrCode && qrCode.length > 10) {
        return {
          status: 'qr',
          qrCode: qrCode,
          provider: 'UAZAPI'
        };
      }
    }

    return {
      status: 'disconnected',
      provider: 'UAZAPI'
    };
  });
}

async function checkStatusUAZAPI(baseUrl: string, instanceToken: string) {
  return await retryWithBackoff(async () => {
    const statusResponse = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    console.log('Check status response:', statusResponse.status);

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('UAZAPI status check failed:', errorText);
      throw new Error(`Falha ao verificar status (${statusResponse.status})`);
    }

    const statusData = await statusResponse.json();
    console.log('UAZAPI status:', JSON.stringify(statusData));
    
    const { connected, phoneNumber, profileName } = parseConnectionStatus(statusData);
    
    if (connected) {
      return {
        status: 'connected',
        phoneNumber: phoneNumber,
        profileName: profileName,
        provider: 'UAZAPI'
      };
    }

    return {
      status: 'disconnected',
      provider: 'UAZAPI'
    };
  });
}

async function disconnectUAZAPI(baseUrl: string, instanceToken: string) {
  console.log('Disconnecting from UAZAPI');
  
  return await retryWithBackoff(async () => {
    const response = await fetch(`${baseUrl}/instance/logout`, {
      method: 'POST',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Disconnect response:', response.status);
    
    return {
      status: 'disconnected',
      provider: 'UAZAPI'
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log('Action:', action);

    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const UAZAPI_INSTANCE_TOKEN = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

    if (!UAZAPI_BASE_URL || !UAZAPI_INSTANCE_TOKEN) {
      console.error('Missing UAZAPI credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais UAZAPI não configuradas',
          details: 'Configure UAZAPI_BASE_URL e UAZAPI_INSTANCE_TOKEN nos secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, '');
    console.log('Using base URL:', baseUrl);

    let result;

    switch (action) {
      case 'test':
        console.log('Testing UAZAPI credentials');
        const isValid = await testUAZAPI(baseUrl, UAZAPI_INSTANCE_TOKEN);
        result = { 
          success: isValid,
          provider: 'UAZAPI',
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas.'
        };
        break;

      case 'initialize':
        console.log('Initializing WhatsApp session');
        result = await initializeUAZAPI(baseUrl, UAZAPI_INSTANCE_TOKEN);
        break;

      case 'status':
        console.log('Checking WhatsApp status');
        result = await checkStatusUAZAPI(baseUrl, UAZAPI_INSTANCE_TOKEN);
        break;

      case 'disconnect':
        console.log('Disconnecting WhatsApp');
        result = await disconnectUAZAPI(baseUrl, UAZAPI_INSTANCE_TOKEN);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
