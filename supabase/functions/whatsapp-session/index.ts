import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Z-API Helper Functions
async function testZAPI(baseUrl: string, headers: any) {
  try {
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: headers,
    });
    return response.ok;
  } catch (error) {
    console.error('Z-API test failed:', error);
    return false;
  }
}

async function initializeZAPI(baseUrl: string, headers: any) {
  const statusResponse = await fetch(`${baseUrl}/status`, {
    method: 'GET',
    headers: headers,
  });

  if (!statusResponse.ok) {
    throw new Error(`Z-API status check failed: ${statusResponse.status}`);
  }

  const statusData = await statusResponse.json();
  
  if (statusData.connected === true) {
    return {
      status: 'connected',
      phoneNumber: statusData.phone || null,
      provider: 'Z-API'
    };
  }

  const qrResponse = await fetch(`${baseUrl}/qr-code/image`, {
    method: 'GET',
    headers: headers,
  });

  if (!qrResponse.ok) {
    throw new Error('Z-API QR code generation failed');
  }

  const qrData = await qrResponse.json();
  
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
}

async function checkStatusZAPI(baseUrl: string, headers: any) {
  const statusResponse = await fetch(`${baseUrl}/status`, {
    method: 'GET',
    headers: headers,
  });

  if (!statusResponse.ok) {
    throw new Error('Z-API status check failed');
  }

  const statusData = await statusResponse.json();
  
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
}

async function disconnectZAPI(baseUrl: string, headers: any) {
  await fetch(`${baseUrl}/disconnect`, {
    method: 'GET',
    headers: headers,
  });
  
  return {
    status: 'disconnected',
    provider: 'Z-API'
  };
}

// Evolution API Helper Functions
async function testEvolutionAPI(apiUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${apiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Evolution API test failed:', error);
    return false;
  }
}

async function initializeEvolutionAPI(apiUrl: string, apiKey: string, instanceName: string = 'whatsapp-instance') {
  // Check if instance exists
  const instancesResponse = await fetch(`${apiUrl}/instance/fetchInstances`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
  });

  if (!instancesResponse.ok) {
    throw new Error('Evolution API instance fetch failed');
  }

  const instances = await instancesResponse.json();
  const existingInstance = instances.find((i: any) => i.instanceName === instanceName);

  if (!existingInstance) {
    // Create instance
    const createResponse = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Evolution API instance creation failed');
    }
  }

  // Get connection status
  const statusResponse = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
  });

  if (!statusResponse.ok) {
    throw new Error('Evolution API status check failed');
  }

  const statusData = await statusResponse.json();

  if (statusData.state === 'open') {
    return {
      status: 'connected',
      phoneNumber: statusData.instance?.owner || null,
      provider: 'Evolution API'
    };
  }

  // Get QR code
  const qrResponse = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
  });

  if (!qrResponse.ok) {
    throw new Error('Evolution API QR code generation failed');
  }

  const qrData = await qrResponse.json();
  
  if (qrData.base64) {
    return {
      status: 'qr',
      qrCode: qrData.base64,
      provider: 'Evolution API'
    };
  }

  return {
    status: 'disconnected',
    provider: 'Evolution API'
  };
}

async function checkStatusEvolutionAPI(apiUrl: string, apiKey: string, instanceName: string = 'whatsapp-instance') {
  const statusResponse = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
    method: 'GET',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
  });

  if (!statusResponse.ok) {
    throw new Error('Evolution API status check failed');
  }

  const statusData = await statusResponse.json();

  if (statusData.state === 'open') {
    return {
      status: 'connected',
      phoneNumber: statusData.instance?.owner || null,
      provider: 'Evolution API'
    };
  }

  return {
    status: 'disconnected',
    provider: 'Evolution API'
  };
}

async function disconnectEvolutionAPI(apiUrl: string, apiKey: string, instanceName: string = 'whatsapp-instance') {
  await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
    method: 'DELETE',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
  });

  return {
    status: 'disconnected',
    provider: 'Evolution API'
  };
}

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

    // Get credentials for both providers
    const ZAPI_INSTANCE = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');
    
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    const hasZAPICredentials = ZAPI_INSTANCE && ZAPI_TOKEN && ZAPI_CLIENT_TOKEN;
    const hasEvolutionCredentials = EVOLUTION_API_URL && EVOLUTION_API_KEY;

    if (!hasZAPICredentials && !hasEvolutionCredentials) {
      throw new Error('Neither Z-API nor Evolution API credentials are configured');
    }

    let zapiBaseUrl: string | null = null;
    let zapiHeaders: any = null;
    
    if (hasZAPICredentials) {
      zapiBaseUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;
      zapiHeaders = {
        'Client-Token': ZAPI_CLIENT_TOKEN,
        'Content-Type': 'application/json'
      };
    }
    
    
    console.log(`Action: ${action}`);

    if (action === 'test') {
      // Test both providers and return which ones are available
      const zapiWorks = hasZAPICredentials ? await testZAPI(zapiBaseUrl!, zapiHeaders) : false;
      const evolutionWorks = hasEvolutionCredentials ? await testEvolutionAPI(EVOLUTION_API_URL!, EVOLUTION_API_KEY!) : false;

      if (!zapiWorks && !evolutionWorks) {
        return new Response(
          JSON.stringify({ 
            status: 'error',
            error: 'Nenhuma API disponível. Verifique suas credenciais.',
            providers: {
              zapi: zapiWorks,
              evolution: evolutionWorks
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          status: 'success',
          message: zapiWorks ? 'Z-API disponível' : 'Evolution API disponível',
          providers: {
            zapi: zapiWorks,
            evolution: evolutionWorks
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'initialize') {
      let result;
      let lastError;

      // Try Z-API first
      if (hasZAPICredentials) {
        try {
          console.log('Trying Z-API...');
          result = await initializeZAPI(zapiBaseUrl!, zapiHeaders);
          console.log('Z-API successful:', result);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Z-API failed:', error.message);
          lastError = error;
        }
      }

      // Fallback to Evolution API
      if (hasEvolutionCredentials) {
        try {
          console.log('Trying Evolution API as fallback...');
          result = await initializeEvolutionAPI(EVOLUTION_API_URL!, EVOLUTION_API_KEY!);
          console.log('Evolution API successful:', result);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Evolution API failed:', error.message);
          lastError = error;
        }
      }

      // Both failed
      throw lastError || new Error('Failed to initialize WhatsApp session');
    }

    if (action === 'status') {
      let result;
      let lastError;

      // Try Z-API first
      if (hasZAPICredentials) {
        try {
          result = await checkStatusZAPI(zapiBaseUrl!, zapiHeaders);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Z-API status check failed:', error.message);
          lastError = error;
        }
      }

      // Fallback to Evolution API
      if (hasEvolutionCredentials) {
        try {
          result = await checkStatusEvolutionAPI(EVOLUTION_API_URL!, EVOLUTION_API_KEY!);
          return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error: any) {
          console.error('Evolution API status check failed:', error.message);
          lastError = error;
        }
      }

      // Both failed - return disconnected
      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      // Try to disconnect from both providers
      if (hasZAPICredentials) {
        try {
          await disconnectZAPI(zapiBaseUrl!, zapiHeaders);
        } catch (error) {
          console.error('Z-API disconnect failed:', error);
        }
      }

      if (hasEvolutionCredentials) {
        try {
          await disconnectEvolutionAPI(EVOLUTION_API_URL!, EVOLUTION_API_KEY!);
        } catch (error) {
          console.error('Evolution API disconnect failed:', error);
        }
      }

      return new Response(
        JSON.stringify({ status: 'disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
        type: error.name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
