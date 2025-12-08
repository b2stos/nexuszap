import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // UAZAPI/Evolution API - try multiple endpoint formats
    console.log(`Sending message to ${cleanPhone} via UAZAPI`);
    
    const requestBody = {
      number: cleanPhone,
      text: message,
    };
    
    // Try /message/send-text endpoint (Evolution API v2 format)
    console.log(`Trying endpoint: ${baseUrl}/message/send-text`);
    let uazapiResponse = await fetch(`${baseUrl}/message/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": UAZAPI_INSTANCE_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', uazapiResponse.status);
    let responseText = await uazapiResponse.text();
    console.log("Response:", responseText);
    
    // If that fails, try /send-text (another common format)
    if (!uazapiResponse.ok) {
      console.log(`Trying endpoint: ${baseUrl}/send-text`);
      uazapiResponse = await fetch(`${baseUrl}/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": UAZAPI_INSTANCE_TOKEN,
        },
        body: JSON.stringify({ phone: cleanPhone, message: message }),
      });
      
      console.log('Response status:', uazapiResponse.status);
      responseText = await uazapiResponse.text();
      console.log("Response:", responseText);
    }
    
    // If still fails, try /chat/send (WPPConnect format)
    if (!uazapiResponse.ok) {
      console.log(`Trying endpoint: ${baseUrl}/chat/send`);
      uazapiResponse = await fetch(`${baseUrl}/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": UAZAPI_INSTANCE_TOKEN,
        },
        body: JSON.stringify({ phone: cleanPhone, message: message }),
      });
      
      console.log('Response status:', uazapiResponse.status);
      responseText = await uazapiResponse.text();
      console.log("Response:", responseText);
    }

    if (!uazapiResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: responseText || "Erro ao enviar mensagem",
          code: "SEND_ERROR",
          details: "Nenhum endpoint de envio funcionou. Verifique a documentação da UAZAPI."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const uazapiData = JSON.parse(responseText);
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

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Mensagem enviada",
          data: uazapiData
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Mensagem enviada"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Error in send-single-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
