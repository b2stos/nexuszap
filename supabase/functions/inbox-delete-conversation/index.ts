import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow DELETE method
    if (req.method !== "DELETE") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { conversationId, hardDelete = false } = await req.json();

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: "conversationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[inbox-delete-conversation] Processing delete for conversation: ${conversationId}, hardDelete: ${hardDelete}`);

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user's tenant to validate permissions
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[inbox-delete-conversation] Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify conversation belongs to user's tenant
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, tenant_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[inbox-delete-conversation] Conversation not found:", convError);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RLS will already validate tenant access, but let's be explicit
    const { data: tenantUser, error: tenantError } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", conversation.tenant_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (tenantError || !tenantUser) {
      console.error("[inbox-delete-conversation] User not in tenant:", tenantError);
      return new Response(
        JSON.stringify({ error: "Forbidden - not a member of this tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();

    // Use service role for soft/hard delete operations (mt_messages has no DELETE policy)
    const supabaseServiceRole = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (hardDelete) {
      // Hard delete: remove messages first, then conversation
      console.log("[inbox-delete-conversation] Performing hard delete");

      const { error: msgDeleteError } = await supabaseServiceRole
        .from("mt_messages")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (msgDeleteError) {
        console.error("[inbox-delete-conversation] Error deleting messages:", msgDeleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete messages" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: convDeleteError } = await supabaseServiceRole
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (convDeleteError) {
        console.error("[inbox-delete-conversation] Error deleting conversation:", convDeleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete conversation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Soft delete: set deleted_at timestamp
      console.log("[inbox-delete-conversation] Performing soft delete");

      // Soft delete messages
      const { error: msgUpdateError } = await supabaseServiceRole
        .from("mt_messages")
        .update({ deleted_at: now })
        .eq("conversation_id", conversationId)
        .eq("tenant_id", conversation.tenant_id)
        .is("deleted_at", null);

      if (msgUpdateError) {
        console.error("[inbox-delete-conversation] Error soft-deleting messages:", msgUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to delete messages" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Soft delete conversation
      const { error: convUpdateError } = await supabaseServiceRole
        .from("conversations")
        .update({ deleted_at: now })
        .eq("id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (convUpdateError) {
        console.error("[inbox-delete-conversation] Error soft-deleting conversation:", convUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to delete conversation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[inbox-delete-conversation] Successfully deleted conversation: ${conversationId}`);

    return new Response(
      JSON.stringify({ ok: true, conversationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[inbox-delete-conversation] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
