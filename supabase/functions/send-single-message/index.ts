import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to try sending message with different endpoint/format combinations
async function tryUAZAPISend(
  baseUrl: string, 
  token: string, 
  phone: string, 
  message: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  
  // Different number formats to try
  const numberFormats = [
    phone,                          // Just numbers: 5511947892299
    `${phone}@c.us`,               // WhatsApp contact: 5511947892299@c.us
    `${phone}@s.whatsapp.net`,     // Alternative format
  ];
  
  // Different endpoint/body combinations to try
  const endpoints = [
    { 
      path: '/message/sendText', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/message/text', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/sendText', 
      bodyFn: (num: string) => ({ number: num, text: message })
    },
    { 
      path: '/chat/send/text', 
      bodyFn: (num: string) => ({ Phone: num, Body: message })
    },
    { 
      path: '/send-message', 
      bodyFn: (num: string) => ({ chatId: num, contentType: 'string', content: message })
    },
    { 
      path: '/message/send', 
      bodyFn: (num: string) => ({ to: num, type: 'text', text: { body: message } })
    },
  ];

  // Try each combination
  for (const numberFormat of numberFormats) {
    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint.path}`;
      const body = endpoint.bodyFn(numberFormat);
      
      console.log(`Trying: ${url}`);
      console.log(`Body: ${JSON.stringify(body)}`);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": token,
          },
          body: JSON.stringify(body),
        });
        
        const responseText = await response.text();
        console.log(`Status: ${response.status}, Response: ${responseText}`);
        
        // Check if successful (status 200-299 and not an error message)
        if (response.ok) {
          try {
            const data = JSON.parse(responseText);
            // Check if response indicates success
            if (!data.error && !data.message?.includes('Not Allowed') && !data.message?.includes('not found')) {
              console.log(`SUCCESS with: ${url} and number format: ${numberFormat}`);
              return { success: true, response: data };
            }
          } catch {
            // Response wasn't JSON but was 200 OK
            if (!responseText.includes('error') && !responseText.includes('Not Allowed')) {
              console.log(`SUCCESS (non-JSON) with: ${url}`);
              return { success: true, response: responseText };
            }
          }
        }
        
        // If 405 or other client error, continue to next combination
        if (response.status >= 400 && response.status < 500) {
          console.log(`Client error ${response.status}, trying next combination...`);
          continue;
        }
        
      } catch (fetchError) {
        console.error(`Fetch error for ${url}:`, fetchError);
        continue;
      }
    }
  }
  
  return { success: false, error: "Nenhum endpoint funcionou. Verifique a configuração da UAZAPI." };
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
    
    // Try all endpoint/format combinations
    const result = await tryUAZAPISend(baseUrl, UAZAPI_INSTANCE_TOKEN, cleanPhone, message);
    
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
