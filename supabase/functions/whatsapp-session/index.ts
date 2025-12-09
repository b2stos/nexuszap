import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

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

// Get user's UAZAPI credentials from database
async function getUserCredentials(supabase: any, userId: string): Promise<{ baseUrl: string; token: string } | null> {
  const { data, error } = await supabase
    .from('uazapi_config')
    .select('base_url, instance_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.log('No user UAZAPI config found, checking env fallback');
    return null;
  }

  return {
    baseUrl: data.base_url.replace(/\/$/, ''),
    token: data.instance_token
  };
}

// Parse UAZAPI response to check connection status
function parseConnectionStatus(data: any): { connected: boolean; phoneNumber: string | null; profileName: string | null } {
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
      
      const qrCode = statusData.instance?.qrcode || statusData.qrcode;
      if (qrCode && qrCode.length > 10) {
        return {
          status: 'qr',
          qrCode: qrCode,
          provider: 'UAZAPI'
        };
      }
    }

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

    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to get user's UAZAPI credentials from database
    let credentials = await getUserCredentials(supabase, user.id);
    
    // Fallback to environment variables if no user config
    if (!credentials) {
      const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
      const UAZAPI_INSTANCE_TOKEN = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

      if (!UAZAPI_BASE_URL || !UAZAPI_INSTANCE_TOKEN) {
        console.error('Missing UAZAPI credentials');
        return new Response(
          JSON.stringify({ 
            error: 'Credenciais UAZAPI não configuradas',
            details: 'Configure suas credenciais na página WhatsApp'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      credentials = {
        baseUrl: UAZAPI_BASE_URL.replace(/\/$/, ''),
        token: UAZAPI_INSTANCE_TOKEN
      };
    }

    console.log('Using base URL:', credentials.baseUrl);

    let result;

    switch (action) {
      case 'test':
        console.log('Testing UAZAPI credentials');
        const isValid = await testUAZAPI(credentials.baseUrl, credentials.token);
        result = { 
          success: isValid,
          provider: 'UAZAPI',
          message: isValid ? 'Credenciais válidas' : 'Credenciais inválidas.'
        };
        break;

      case 'initialize':
        console.log('Initializing WhatsApp session');
        result = await initializeUAZAPI(credentials.baseUrl, credentials.token);
        break;

      case 'status':
        console.log('Checking WhatsApp status');
        result = await checkStatusUAZAPI(credentials.baseUrl, credentials.token);
        break;

      case 'disconnect':
        console.log('Disconnecting WhatsApp');
        result = await disconnectUAZAPI(credentials.baseUrl, credentials.token);
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