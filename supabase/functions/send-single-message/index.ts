import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get or create UAZAPI instance
async function getOrCreateInstance(baseUrl: string, adminToken: string): Promise<{ instanceId: string; instanceToken: string }> {
  const listResponse = await fetch(`${baseUrl}/instance/list`, {
    method: 'GET',
    headers: {
      'apikey': adminToken,
      'Content-Type': 'application/json'
    },
  });

  if (listResponse.ok) {
    const instances = await listResponse.json();
    if (Array.isArray(instances) && instances.length > 0) {
      const instance = instances[0];
      return {
        instanceId: instance.instanceName || instance.id || instance.name,
        instanceToken: instance.token || instance.apikey || adminToken
      };
    }
  }

  throw new Error('Nenhuma instância UAZAPI encontrada. Configure o WhatsApp primeiro.');
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
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");

    if (!UAZAPI_BASE_URL || !UAZAPI_ADMIN_TOKEN) {
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

    // Get UAZAPI instance
    const { instanceId, instanceToken } = await getOrCreateInstance(baseUrl, UAZAPI_ADMIN_TOKEN);

    // Send message via UAZAPI
    const uazapiUrl = `${baseUrl}/message/sendText/${instanceId}`;
    
    console.log(`Sending message to ${cleanPhone} via UAZAPI`);
    
    const uazapiResponse = await fetch(uazapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": instanceToken,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    const uazapiData = await uazapiResponse.json();
    console.log("UAZAPI response:", uazapiData);

    if (!uazapiResponse.ok) {
      // Check for specific error codes
      if (uazapiData.error === "Unauthorized" || uazapiResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: "WhatsApp não conectado ou credenciais inválidas",
            code: "WHATSAPP_DISCONNECTED"
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: uazapiData.error || uazapiData.message || "Erro ao enviar mensagem",
          code: "SEND_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if message was actually queued/sent
    const messageId = uazapiData.key?.id || uazapiData.messageId || uazapiData.id;
    if (messageId) {
      console.log(`Message sent successfully. ID: ${messageId}`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          messageId: messageId,
          message: "Mensagem enviada com sucesso"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle unexpected response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Mensagem enviada",
        data: uazapiData
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
