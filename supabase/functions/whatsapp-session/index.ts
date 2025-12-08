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

// UAZAPI Helper Functions
async function getOrCreateInstance(baseUrl: string, adminToken: string): Promise<{ instanceId: string; instanceToken: string }> {
  console.log('Getting or creating UAZAPI instance');
  
  // First, list existing instances
  const listResponse = await fetch(`${baseUrl}/instance/list`, {
    method: 'GET',
    headers: {
      'apikey': adminToken,
      'Content-Type': 'application/json'
    },
  });

  if (listResponse.ok) {
    const instances = await listResponse.json();
    console.log('Existing instances:', instances);
    
    // If we have instances, use the first one
    if (Array.isArray(instances) && instances.length > 0) {
      const instance = instances[0];
      return {
        instanceId: instance.instanceName || instance.id || instance.name,
        instanceToken: instance.token || instance.apikey || adminToken
      };
    }
  }

  // Create new instance if none exists
  console.log('Creating new UAZAPI instance');
  const createResponse = await fetch(`${baseUrl}/instance/create`, {
    method: 'POST',
    headers: {
      'apikey': adminToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instanceName: `lovable-${Date.now()}`,
      qrcode: true
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Failed to create instance:', errorText);
    throw new Error(`Falha ao criar instância UAZAPI: ${errorText}`);
  }

  const newInstance = await createResponse.json();
  console.log('New instance created:', newInstance);
  
  return {
    instanceId: newInstance.instanceName || newInstance.id || newInstance.name,
    instanceToken: newInstance.token || newInstance.apikey || adminToken
  };
}

async function testUAZAPI(baseUrl: string, adminToken: string) {
  try {
    console.log('Testing UAZAPI connection:', baseUrl);
    
    const response = await fetch(`${baseUrl}/instance/list`, {
      method: 'GET',
      headers: {
        'apikey': adminToken,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('UAZAPI test failed - Status:', response.status, 'Error:', errorText);
      return false;
    }
    
    const data = await response.json();
    console.log('UAZAPI test response:', data);
    return true;
  } catch (error) {
    console.error('UAZAPI test exception:', error);
    return false;
  }
}

async function initializeUAZAPI(baseUrl: string, adminToken: string) {
  console.log('Initializing UAZAPI connection');
  
  return await retryWithBackoff(async () => {
    const { instanceId, instanceToken } = await getOrCreateInstance(baseUrl, adminToken);
    
    // Check current status
    const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceId}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('UAZAPI status response:', statusData);
      
      // Check if already connected
      if (statusData.state === 'open' || statusData.instance?.state === 'open') {
        return {
          status: 'connected',
          phoneNumber: statusData.instance?.owner || null,
          provider: 'UAZAPI',
          instanceId,
          instanceToken
        };
      }
    }

    // Get QR code
    console.log('Requesting QR code from UAZAPI');
    const qrResponse = await fetch(`${baseUrl}/instance/connect/${instanceId}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text();
      console.error('UAZAPI QR code generation failed:', qrResponse.status, errorText);
      throw new Error(`Falha ao gerar QR code: ${errorText}`);
    }

    const qrData = await qrResponse.json();
    console.log('QR code response received');
    
    // UAZAPI returns QR in different formats
    const qrCode = qrData.qrcode?.base64 || qrData.base64 || qrData.code || qrData.qrcode;
    
    if (qrCode) {
      return {
        status: 'qr',
        qrCode: qrCode,
        provider: 'UAZAPI',
        instanceId,
        instanceToken
      };
    }

    return {
      status: 'disconnected',
      provider: 'UAZAPI',
      instanceId,
      instanceToken
    };
  });
}

async function checkStatusUAZAPI(baseUrl: string, adminToken: string) {
  return await retryWithBackoff(async () => {
    const { instanceId, instanceToken } = await getOrCreateInstance(baseUrl, adminToken);
    
    const statusResponse = await fetch(`${baseUrl}/instance/connectionState/${instanceId}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken,
        'Content-Type': 'application/json'
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('UAZAPI status check failed:', statusResponse.status, errorText);
      throw new Error(`Falha ao verificar status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log('UAZAPI status:', statusData);
    
    // Check connection state
    if (statusData.state === 'open' || statusData.instance?.state === 'open') {
      return {
        status: 'connected',
        phoneNumber: statusData.instance?.owner || statusData.instance?.wuid?.split('@')[0] || null,
        provider: 'UAZAPI',
        instanceId,
        instanceToken
      };
    }

    return {
      status: 'disconnected',
      provider: 'UAZAPI',
      instanceId,
      instanceToken
    };
  });
}

async function disconnectUAZAPI(baseUrl: string, adminToken: string) {
  console.log('Disconnecting from UAZAPI');
  
  return await retryWithBackoff(async () => {
    const { instanceId, instanceToken } = await getOrCreateInstance(baseUrl, adminToken);
    
    const response = await fetch(`${baseUrl}/instance/logout/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'apikey': instanceToken,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Disconnect failed:', response.status, errorText);
      throw new Error('Falha ao desconectar');
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
