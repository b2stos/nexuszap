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

// UAZAPI v2 - usando Instance Token
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
    const responseText = await response.text();
    console.log('Test response body:', responseText);
    
    if (!response.ok) {
      console.error('UAZAPI test failed - Status:', response.status);
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
    const statusText = await statusResponse.text();
    console.log('Status response body:', statusText);

    if (statusResponse.ok) {
      try {
        const statusData = JSON.parse(statusText);
        console.log('UAZAPI status:', JSON.stringify(statusData));
        
        // Check if already connected
        const state = statusData.state || statusData.status || statusData.connectionStatus;
        if (state === 'connected' || state === 'open' || statusData.connected === true) {
          return {
            status: 'connected',
            phoneNumber: statusData.phone || statusData.wid || statusData.jid?.split('@')[0] || null,
            provider: 'UAZAPI'
          };
        }
      } catch (e) {
        console.log('Could not parse status response as JSON');
      }
    }

    // Get QR code
    console.log('Requesting QR code from UAZAPI');
    const qrResponse = await fetch(`${baseUrl}/instance/qrcode`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    console.log('QR response status:', qrResponse.status);
    const qrText = await qrResponse.text();
    console.log('QR response body (first 300 chars):', qrText.substring(0, 300));

    if (qrResponse.ok) {
      try {
        const qrData = JSON.parse(qrText);
        const qrCode = qrData.qrcode || qrData.base64 || qrData.code || qrData.qr || qrData.pairingCode;
        
        if (qrCode) {
          return {
            status: 'qr',
            qrCode: qrCode,
            provider: 'UAZAPI'
          };
        }
      } catch (e) {
        // Maybe it's a direct base64 image
        if (qrText.length > 100) {
          return {
            status: 'qr',
            qrCode: qrText,
            provider: 'UAZAPI'
          };
        }
      }
    }

    // Try alternative connect endpoint
    console.log('Trying connect endpoint');
    const connectResponse = await fetch(`${baseUrl}/instance/connect`, {
      method: 'GET',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    console.log('Connect response status:', connectResponse.status);
    const connectText = await connectResponse.text();
    console.log('Connect response body (first 300 chars):', connectText.substring(0, 300));

    if (connectResponse.ok) {
      try {
        const connectData = JSON.parse(connectText);
        const qrCode = connectData.qrcode || connectData.base64 || connectData.code || connectData.qr;
        
        if (qrCode) {
          return {
            status: 'qr',
            qrCode: qrCode,
            provider: 'UAZAPI'
          };
        }
      } catch (e) {
        console.log('Could not parse connect response');
      }
    }

    return {
      status: 'disconnected',
      provider: 'UAZAPI',
      message: 'Não foi possível obter QR code. Verifique o Instance Token.'
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
    const statusText = await statusResponse.text();
    console.log('Status body:', statusText);

    if (!statusResponse.ok) {
      console.error('UAZAPI status check failed:', statusResponse.status);
      throw new Error(`Falha ao verificar status (${statusResponse.status})`);
    }

    try {
      const statusData = JSON.parse(statusText);
      console.log('UAZAPI status:', JSON.stringify(statusData));
      
      const state = statusData.state || statusData.status || statusData.connectionStatus;
      if (state === 'connected' || state === 'open' || statusData.connected === true) {
        return {
          status: 'connected',
          phoneNumber: statusData.phone || statusData.wid || statusData.jid?.split('@')[0] || null,
          provider: 'UAZAPI'
        };
      }
    } catch (e) {
      console.log('Could not parse status as JSON');
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
    
    if (!response.ok) {
      // Try DELETE method
      const altResponse = await fetch(`${baseUrl}/instance/logout`, {
        method: 'DELETE',
        headers: {
          'token': instanceToken,
          'Content-Type': 'application/json'
        },
      });
      
      console.log('Alt disconnect response:', altResponse.status);
    }
    
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

    // Get UAZAPI credentials
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
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas. Verifique sua URL e Instance Token.'
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
