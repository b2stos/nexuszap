import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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

    // Get Z-API credentials
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const token = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !token) {
      console.error("Z-API credentials not configured");
      return new Response(
        JSON.stringify({ 
          error: "API do WhatsApp não configurada",
          code: "WHATSAPP_NOT_CONFIGURED"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    
    console.log(`Sending message to ${cleanPhone}`);
    
    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientToken && { "Client-Token": clientToken }),
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
      }),
    });

    const zapiData = await zapiResponse.json();
    console.log("Z-API response:", zapiData);

    if (!zapiResponse.ok) {
      // Check for specific error codes
      if (zapiData.error === "Unauthorized" || zapiResponse.status === 401) {
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
          error: zapiData.error || "Erro ao enviar mensagem",
          code: "SEND_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if message was actually queued/sent
    if (zapiData.zapiMessageId || zapiData.messageId) {
      console.log(`Message sent successfully. ID: ${zapiData.zapiMessageId || zapiData.messageId}`);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          messageId: zapiData.zapiMessageId || zapiData.messageId,
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
        data: zapiData
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
