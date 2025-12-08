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

    // UAZAPI uses Evolution API format: /message/sendText with apikey header
    // The body uses "number" and "text" fields
    console.log(`Sending message to ${cleanPhone} via UAZAPI`);
    console.log(`Using endpoint: ${baseUrl}/message/sendText`);
    
    const requestBody = {
      number: cleanPhone,
      text: message,
    };
    
    console.log('Request body:', JSON.stringify(requestBody));

    const uazapiResponse = await fetch(`${baseUrl}/message/sendText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": UAZAPI_INSTANCE_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('UAZAPI response status:', uazapiResponse.status);
    const responseText = await uazapiResponse.text();
    console.log("UAZAPI response:", responseText);

    if (!uazapiResponse.ok) {
      // If apikey header doesn't work, try with 'token' header
      if (uazapiResponse.status === 405 || uazapiResponse.status === 401) {
        console.log("Trying with 'token' header instead...");
        
        const retryResponse = await fetch(`${baseUrl}/message/sendText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": UAZAPI_INSTANCE_TOKEN,
          },
          body: JSON.stringify(requestBody),
        });

        console.log('Retry response status:', retryResponse.status);
        const retryText = await retryResponse.text();
        console.log("Retry response:", retryText);

        if (!retryResponse.ok) {
          // Try another endpoint format: /send/text
          console.log("Trying /send/text endpoint...");
          
          const sendTextResponse = await fetch(`${baseUrl}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": UAZAPI_INSTANCE_TOKEN,
            },
            body: JSON.stringify({
              phone: cleanPhone,
              message: message,
            }),
          });

          console.log('send/text response status:', sendTextResponse.status);
          const sendTextText = await sendTextResponse.text();
          console.log("send/text response:", sendTextText);

          if (!sendTextResponse.ok) {
            return new Response(
              JSON.stringify({ 
                error: sendTextText || retryText || "Erro ao enviar mensagem",
                code: "SEND_ERROR"
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Parse successful response from /send/text
          try {
            const sendData = JSON.parse(sendTextText);
            return new Response(
              JSON.stringify({ 
                success: true,
                messageId: sendData.key?.id || sendData.messageId,
                message: "Mensagem enviada com sucesso"
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } catch {
            return new Response(
              JSON.stringify({ success: true, message: "Mensagem enviada" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Parse successful retry response
        try {
          const retryData = JSON.parse(retryText);
          return new Response(
            JSON.stringify({ 
              success: true,
              messageId: retryData.key?.id || retryData.messageId,
              message: "Mensagem enviada com sucesso"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ success: true, message: "Mensagem enviada" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          error: responseText || "Erro ao enviar mensagem",
          code: "SEND_ERROR"
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
