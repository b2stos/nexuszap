import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Helper function to sleep/delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper with exponential backoff
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
    
    // Exponential backoff: double the delay for next retry
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

// Z-API Helper Functions
async function testZAPI(baseUrl: string, headers: any) {
  try {
    console.log('Testing Z-API connection:', baseUrl);
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Z-API test failed - Status:', response.status, 'Error:', errorText);
      return false;
    }
    
    const data = await response.json();
    console.log('Z-API test response:', data);
    
    // "You are already connected" means credentials are valid
    if (data.error === "You are already connected.") {
      console.log('Z-API test: Already connected (valid credentials)');
      return true;
    }
    
    // Check for other errors
    if (data.error && data.error !== "You are already connected.") {
      console.error('Z-API returned error:', data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Z-API test exception:', error);
    return false;
  }
}

async function initializeZAPI(baseUrl: string, headers: any) {
  console.log('Initializing Z-API connection');
  
  return await retryWithBackoff(async () => {
    const statusResponse = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: headers,
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Z-API status check failed:', statusResponse.status, errorText);
      throw new Error(`Z-API não disponível. Status: ${statusResponse.status}. Verifique suas credenciais.`);
    }

    const statusData = await statusResponse.json();
    console.log('Z-API status response:', statusData);
    
    // Special case: Already connected
    if (statusData.error === "You are already connected.") {
      console.log('WhatsApp already connected');
      return {
        status: 'connected',
        phoneNumber: statusData.phone || null,
        provider: 'Z-API',
        message: 'WhatsApp já está conectado'
      };
    }
    
    // Check for other errors
    if (statusData.error) {
      console.error('Z-API returned error:', statusData);
      throw new Error(`Erro Z-API: ${statusData.error} - ${statusData.message || 'Verifique suas credenciais no painel Z-API'}`);
    }
    
    // If already connected via connected field
    if (statusData.connected === true) {
      console.log('WhatsApp already connected');
      return {
        status: 'connected',
        phoneNumber: statusData.phone || null,
        provider: 'Z-API'
      };
    }

    // Try to get QR code
    console.log('Requesting QR code from Z-API');
    const qrResponse = await fetch(`${baseUrl}/qr-code/image`, {
      method: 'GET',
      headers: headers,
    });

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('Z-API QR code generation failed:', qrResponse.status, errorText);
      throw new Error(`Falha ao gerar QR code. Status: ${qrResponse.status}`);
    }

    const qrData = await qrResponse.json();
    console.log('QR code response received:', qrData ? 'success' : 'empty');
    
    if (qrData.value) {
      return {
        status: 'qr',
        qrCode: qrData.value,
        provider: 'Z-API'
      };
    }

    return {
      status: 'disconnected',
      provider: 'Z-API'
    };
  });
}

async function checkStatusZAPI(baseUrl: string, headers: any) {
  return await retryWithBackoff(async () => {
    const statusResponse = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: headers,
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Z-API status check failed:', statusResponse.status, errorText);
      
      // Try to parse the error response
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          throw new Error(`Erro Z-API: ${errorData.error}`);
        }
      } catch (parseError) {
        // If parsing fails, use generic error
      }
      
      throw new Error(`Falha ao verificar status (${statusResponse.status})`);
    }

    const statusData = await statusResponse.json();
    
    // Special case: Already connected
    if (statusData.error === "You are already connected.") {
      console.log('Status check: Already connected');
      return {
        status: 'connected',
        phoneNumber: statusData.phone || null,
        provider: 'Z-API'
      };
    }
    
    // Check for other errors
    if (statusData.error) {
      console.error('Z-API returned error:', statusData);
      throw new Error(`Erro: ${statusData.error}`);
    }
    
    if (statusData.connected === true) {
      return {
        status: 'connected',
        phoneNumber: statusData.phone || null,
        provider: 'Z-API'
      };
    }

    return {
      status: 'disconnected',
      provider: 'Z-API'
    };
  });
}

async function disconnectZAPI(baseUrl: string, headers: any) {
  console.log('Disconnecting from Z-API');
  
  return await retryWithBackoff(async () => {
    const response = await fetch(`${baseUrl}/disconnect`, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      console.error('Disconnect failed:', response.status);
      throw new Error('Falha ao desconectar');
    }
    
    return {
      status: 'disconnected',
      provider: 'Z-API'
    };
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    console.log('Action:', action);

    // Get Z-API credentials
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      console.error('Missing Z-API credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais Z-API não configuradas',
          details: 'Configure ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nos secrets'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const zapiBaseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
    const zapiHeaders = {
      'Client-Token': ZAPI_CLIENT_TOKEN,
      'Content-Type': 'application/json'
    };

    let result;

    switch (action) {
      case 'test':
        console.log('Testing Z-API credentials');
        const isValid = await testZAPI(zapiBaseUrl, zapiHeaders);
        result = { 
          success: isValid,
          provider: 'Z-API',
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas. Verifique no painel Z-API.'
        };
        break;

      case 'initialize':
        console.log('Initializing WhatsApp session');
        result = await initializeZAPI(zapiBaseUrl, zapiHeaders);
        break;

      case 'status':
        console.log('Checking WhatsApp status');
        result = await checkStatusZAPI(zapiBaseUrl, zapiHeaders);
        break;

      case 'disconnect':
        console.log('Disconnecting WhatsApp');
        result = await disconnectZAPI(zapiBaseUrl, zapiHeaders);
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
