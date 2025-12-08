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

// UAZAPI Helper Functions - Using correct headers: admintoken and token
async function getOrCreateInstance(baseUrl: string, adminToken: string): Promise<{ instanceId: string; instanceToken: string }> {
  console.log('Getting or creating UAZAPI instance');
  
  // List existing instances using admintoken header
  const listResponse = await fetch(`${baseUrl}/admin/instances`, {
    method: 'GET',
    headers: {
      'admintoken': adminToken,
      'Content-Type': 'application/json'
    },
  });

  console.log('List instances response status:', listResponse.status);

  if (listResponse.ok) {
    const instances = await listResponse.json();
    console.log('Existing instances:', JSON.stringify(instances));
    
    // If we have instances, use the first one
    if (Array.isArray(instances) && instances.length > 0) {
      const instance = instances[0];
      return {
        instanceId: instance.name || instance.instanceName || instance.id,
        instanceToken: instance.token || adminToken
      };
    }
    
    // Check if it's an object with instances array
    if (instances.instances && Array.isArray(instances.instances) && instances.instances.length > 0) {
      const instance = instances.instances[0];
      return {
        instanceId: instance.name || instance.instanceName || instance.id,
        instanceToken: instance.token || adminToken
      };
    }
  } else {
    const errorText = await listResponse.text();
    console.log('List instances error:', errorText);
  }

  // Create new instance if none exists
  console.log('Creating new UAZAPI instance');
  const instanceName = `lovable-${Date.now()}`;
  
  const createResponse = await fetch(`${baseUrl}/admin/instance/create`, {
    method: 'POST',
    headers: {
      'admintoken': adminToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: instanceName,
      qrcode: true
    }),
  });

  console.log('Create instance response status:', createResponse.status);

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('Failed to create instance:', errorText);
    throw new Error(`Falha ao criar instância UAZAPI: ${errorText}`);
  }

  const newInstance = await createResponse.json();
  console.log('New instance created:', JSON.stringify(newInstance));
  
  return {
    instanceId: newInstance.name || newInstance.instanceName || instanceName,
    instanceToken: newInstance.token || adminToken
  };
}

async function testUAZAPI(baseUrl: string, adminToken: string) {
  try {
    console.log('Testing UAZAPI connection:', baseUrl);
    
    const response = await fetch(`${baseUrl}/admin/instances`, {
      method: 'GET',
      headers: {
        'admintoken': adminToken,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Test response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('UAZAPI test failed - Status:', response.status, 'Error:', errorText);
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

async function initializeUAZAPI(baseUrl: string, adminToken: string) {
  console.log('Initializing UAZAPI connection');
  
  return await retryWithBackoff(async () => {
    const { instanceId, instanceToken } = await getOrCreateInstance(baseUrl, adminToken);
    console.log(`Using instance: ${instanceId}`);
    
    // Check current status using token header
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
      if (statusData.state === 'connected' || statusData.status === 'connected' || statusData.connected === true) {
        return {
          status: 'connected',
          phoneNumber: statusData.phone || statusData.wid || null,
          provider: 'UAZAPI',
          instanceId,
          instanceToken
        };
      }
    }

    // Get QR code using token header
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
      const errorText = await qrResponse.text();
      console.error('UAZAPI QR code generation failed:', qrResponse.status, errorText);
      throw new Error(`Falha ao gerar QR code: ${errorText}`);
    }

    const qrData = await qrResponse.json();
    console.log('QR code response received:', JSON.stringify(qrData).substring(0, 200));
    
    // UAZAPI returns QR in different formats
    const qrCode = qrData.qrcode || qrData.base64 || qrData.code || qrData.qr;
    
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
    
    // Check connection state
    if (statusData.state === 'connected' || statusData.status === 'connected' || statusData.connected === true) {
      return {
        status: 'connected',
        phoneNumber: statusData.phone || statusData.wid || null,
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
    
    const response = await fetch(`${baseUrl}/instance/logout`, {
      method: 'POST',
      headers: {
        'token': instanceToken,
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Disconnect response:', response.status);
    
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
    console.log('Using base URL:', baseUrl);

    let result;

    switch (action) {
      case 'test':
        console.log('Testing UAZAPI credentials');
        const isValid = await testUAZAPI(baseUrl, UAZAPI_ADMIN_TOKEN);
        result = { 
          success: isValid,
          provider: 'UAZAPI',
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas. Verifique sua URL e Admin Token.'
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
