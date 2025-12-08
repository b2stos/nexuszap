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

// UAZAPI v2 - usando token da instância diretamente
// Endpoints baseados na documentação:
// - GET /instance/status - verifica status
// - GET /instance/qrcode - obtém QR code
// - POST /instance/logout - desconecta
// - POST /chat/send/text - envia mensagem

async function testUAZAPI(baseUrl: string, instanceToken: string) {
  try {
    console.log('Testing UAZAPI connection:', baseUrl);
    
    // Tenta o endpoint de status da instância
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
      console.error('UAZAPI test failed - Status:', response.status, 'Error:', errorText);
      
      // Tenta endpoint alternativo
      console.log('Trying alternative endpoint /status');
      const altResponse = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: {
          'token': instanceToken,
          'Content-Type': 'application/json'
        },
      });
      
      if (altResponse.ok) {
        console.log('Alternative endpoint works');
        return true;
      }
      
      return false;
    }
    
    const data = await response.json();
    console.log('UAZAPI test response:', JSON.stringify(data));
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
      console.log('UAZAPI status response:', JSON.stringify(statusData));
      
      // Check if already connected
      const state = statusData.state || statusData.status || statusData.connectionStatus;
      if (state === 'connected' || state === 'open' || statusData.connected === true) {
        return {
          status: 'connected',
          phoneNumber: statusData.phone || statusData.wid || statusData.jid?.split('@')[0] || null,
          provider: 'UAZAPI'
        };
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

    if (!qrResponse.ok) {
      // Try alternative endpoint
      console.log('Trying alternative QR endpoint');
      const altQrResponse = await fetch(`${baseUrl}/instance/connect`, {
        method: 'GET',
        headers: {
          'token': instanceToken,
          'Content-Type': 'application/json'
        },
      });
      
      if (altQrResponse.ok) {
        const altQrData = await altQrResponse.json();
        console.log('Alternative QR response:', JSON.stringify(altQrData).substring(0, 200));
        const qrCode = altQrData.qrcode || altQrData.base64 || altQrData.code || altQrData.qr;
        if (qrCode) {
          return {
            status: 'qr',
            qrCode: qrCode,
            provider: 'UAZAPI'
          };
        }
      }
      
      const errorText = await qrResponse.text();
      console.error('UAZAPI QR code generation failed:', qrResponse.status, errorText);
      throw new Error(`Falha ao gerar QR code: ${errorText}`);
    }

    const qrData = await qrResponse.json();
    console.log('QR code response received:', JSON.stringify(qrData).substring(0, 200));
    
    // UAZAPI returns QR in different formats
    const qrCode = qrData.qrcode || qrData.base64 || qrData.code || qrData.qr || qrData.pairingCode;
    
    if (qrCode) {
      return {
        status: 'qr',
        qrCode: qrCode,
        provider: 'UAZAPI'
      };
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
      console.error('UAZAPI status check failed:', statusResponse.status, errorText);
      throw new Error(`Falha ao verificar status (${statusResponse.status})`);
    }

    const statusData = await statusResponse.json();
    console.log('UAZAPI status:', JSON.stringify(statusData));
    
    // Check connection state - try different field names
    const state = statusData.state || statusData.status || statusData.connectionStatus;
    if (state === 'connected' || state === 'open' || statusData.connected === true) {
      return {
        status: 'connected',
        phoneNumber: statusData.phone || statusData.wid || statusData.jid?.split('@')[0] || null,
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
    
    if (!response.ok) {
      // Try DELETE method
      const altResponse = await fetch(`${baseUrl}/instance/logout`, {
        method: 'DELETE',
        headers: {
          'token': instanceToken,
          'Content-Type': 'application/json'
        },
      });
      
      if (!altResponse.ok) {
        const errorText = await response.text();
        console.error('Disconnect failed:', response.status, errorText);
        throw new Error('Falha ao desconectar');
      }
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
    // UAZAPI_BASE_URL: URL base (ex: https://base360.uazapi.com)
    // UAZAPI_ADMIN_TOKEN: Token da instância (usado como 'token' header)
    const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
    const UAZAPI_ADMIN_TOKEN = Deno.env.get('UAZAPI_ADMIN_TOKEN');

    if (!UAZAPI_BASE_URL || !UAZAPI_ADMIN_TOKEN) {
      console.error('Missing UAZAPI credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais UAZAPI não configuradas',
          details: 'Configure UAZAPI_BASE_URL e UAZAPI_ADMIN_TOKEN nos secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Remove trailing slash from base URL if present
    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, '');
    console.log('Using base URL:', baseUrl);

    let result;

    switch (action) {
      case 'test':
        console.log('Testing UAZAPI credentials');
        const isValid = await testUAZAPI(baseUrl, UAZAPI_ADMIN_TOKEN);
        result = { 
          success: isValid,
          provider: 'UAZAPI',
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas. Verifique sua URL e Token.'
        };
        break;

      case 'initialize':
        console.log('Initializing WhatsApp session');
        result = await initializeUAZAPI(baseUrl, UAZAPI_ADMIN_TOKEN);
        break;

      case 'status':
        console.log('Checking WhatsApp status');
        result = await checkStatusUAZAPI(baseUrl, UAZAPI_ADMIN_TOKEN);
        break;

      case 'disconnect':
        console.log('Disconnecting WhatsApp');
        result = await disconnectUAZAPI(baseUrl, UAZAPI_ADMIN_TOKEN);
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
