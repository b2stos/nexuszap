import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get instance info first to know the instance name/id
async function getInstanceInfo(baseUrl: string, token: string): Promise<{ instanceName?: string; instanceId?: string }> {
  try {
    const response = await fetch(`${baseUrl}/instance/status`, {
      method: 'GET',
      headers: {
        'token': token,
        'Content-Type': 'application/json'
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        instanceName: data.instance?.name || data.instance?.systemName,
        instanceId: data.instance?.id
      };
    }
  } catch (e) {
    console.error('Error getting instance info:', e);
  }
  return {};
}

// Function to try sending message with different endpoint/format combinations
async function tryUAZAPISend(
  baseUrl: string, 
  token: string, 
  phone: string, 
  message: string,
  instanceName?: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  
  // Different number formats to try - prioritize raw number first
  const numberFormats = [
    phone,                          // Just numbers: 5511947892299
    `${phone}@s.whatsapp.net`,     // WhatsApp internal format
    `${phone}@c.us`,               // WhatsApp contact format
  ];
  
  // Header combinations - uazapi uses lowercase 'token'
  const headerSets = [
    { key: 'token', value: token },
    { key: 'Token', value: token },
    { key: 'apikey', value: token },
  ];
  
  // Endpoint patterns - PRIORITIZE /chat/send/text (uazapi/wuzapi standard)
  const getEndpoints = (instance?: string) => {
    const endpoints = [];
    
    // UAZAPI/Wuzapi standard endpoint - PRIORITIZE THIS
    endpoints.push(
      { path: '/chat/send/text', bodyFn: (num: string) => ({ Phone: num, Body: message }) },
    );
    
    // Evolution API style with instance
    if (instance) {
      endpoints.push(
        { path: `/message/sendText/${instance}`, bodyFn: (num: string) => ({ number: num, text: message }) },
      );
    }
    
    // Other common endpoints
    endpoints.push(
      { path: '/message/sendText', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/send/text', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/sendText', bodyFn: (num: string) => ({ number: num, text: message }) },
      { path: '/send-message', bodyFn: (num: string) => ({ chatId: num, text: message }) },
    );
    
    return endpoints;
  };

  const endpoints = getEndpoints(instanceName);
  
  // Try each combination (limit attempts to avoid timeout)
  let attempts = 0;
  const maxAttempts = 12; // Limit to avoid edge function timeout
  
  for (const headerSet of headerSets) {
    const headers: Record<string, string> = { 
      [headerSet.key]: headerSet.value, 
      'Content-Type': 'application/json' 
    };
    
    for (const numberFormat of numberFormats) {
      for (const endpoint of endpoints) {
        if (attempts >= maxAttempts) {
          console.log(`Reached max attempts (${maxAttempts}), stopping...`);
          break;
        }
        
        const url = `${baseUrl}${endpoint.path}`;
        const body = endpoint.bodyFn(numberFormat);
        
        console.log(`[${++attempts}] Trying: ${url}`);
        console.log(`Headers: ${JSON.stringify(Object.keys(headers))}`);
        console.log(`Body: ${JSON.stringify(body)}`);
        
        try {
          const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          
          const responseText = await response.text();
          console.log(`Status: ${response.status}, Response: ${responseText.substring(0, 200)}`);
          
          // Check if successful (status 200-299)
          if (response.ok) {
            try {
              const data = JSON.parse(responseText);
              // Check if response indicates success (not an error)
              if (!data.error && !data.message?.toLowerCase().includes('not allowed') && !data.message?.toLowerCase().includes('not found')) {
                console.log(`SUCCESS with: ${url}`);
                return { success: true, response: data };
              }
            } catch {
              // Response wasn't JSON but was 200 OK - might still be success
              if (!responseText.toLowerCase().includes('error') && !responseText.toLowerCase().includes('not allowed')) {
                console.log(`SUCCESS (non-JSON) with: ${url}`);
                return { success: true, response: responseText };
              }
            }
          }
          
          // If 404, the endpoint doesn't exist - skip other variations of same endpoint
          if (response.status === 404) {
            console.log(`404 - endpoint doesn't exist, trying next...`);
            break; // Break from number formats, try next endpoint
          }
          
        } catch (fetchError) {
          console.error(`Fetch error for ${url}:`, fetchError);
        }
      }
    }
  }
  
  return { 
    success: false, 
    error: `Nenhum endpoint funcionou após ${attempts} tentativas. Verifique as configurações da UAZAPI.` 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message } = await req.json();

    // Validate input
    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(
        JSON.stringify({ error: "Formato de telefone inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get UAZAPI credentials
    const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
    const UAZAPI_INSTANCE_TOKEN = Deno.env.get("UAZAPI_INSTANCE_TOKEN");

    if (!UAZAPI_BASE_URL || !UAZAPI_INSTANCE_TOKEN) {
      console.error("UAZAPI credentials not configured");
      return new Response(
        JSON.stringify({ 
          error: "API do WhatsApp não configurada",
          code: "WHATSAPP_NOT_CONFIGURED"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, '');

    console.log(`=== Sending message to ${cleanPhone} via UAZAPI ===`);
    console.log(`Base URL: ${baseUrl}`);
    
    // Get instance info
    const instanceInfo = await getInstanceInfo(baseUrl, UAZAPI_INSTANCE_TOKEN);
    console.log(`Instance info: ${JSON.stringify(instanceInfo)}`);
    
    // Try all endpoint/format combinations
    const result = await tryUAZAPISend(
      baseUrl, 
      UAZAPI_INSTANCE_TOKEN, 
      cleanPhone, 
      message,
      instanceInfo.instanceName
    );
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          error: result.error || "Erro ao enviar mensagem",
          code: "SEND_ERROR",
          details: "Verifique os logs para mais detalhes sobre os endpoints testados."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract message ID if available
    const messageId = result.response?.key?.id || result.response?.messageId || result.response?.id;
    
    console.log(`Message sent successfully. ID: ${messageId || 'N/A'}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: messageId,
        message: "Mensagem enviada com sucesso"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-single-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
