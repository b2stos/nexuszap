import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow both DELETE and POST (some browsers/Safari have issues with DELETE + body)
    if (req.method !== "DELETE" && req.method !== "POST") {
      console.log(`[inbox-delete-conversation] Method not allowed: ${req.method}`);
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[inbox-delete-conversation] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let body: { conversationId?: string; hardDelete?: boolean } = {};
    try {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (parseErr) {
      console.error("[inbox-delete-conversation] JSON parse error:", parseErr);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conversationId, hardDelete = false } = body;

    if (!conversationId) {
      console.log("[inbox-delete-conversation] Missing conversationId");
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

    console.log(`[inbox-delete-conversation] User authenticated: ${user.id}`);

    // Use service role for all operations to bypass RLS issues
    const supabaseServiceRole = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify conversation exists and get tenant_id
    const { data: conversation, error: convError } = await supabaseServiceRole
      .from("conversations")
      .select("id, tenant_id, deleted_at")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      console.error("[inbox-delete-conversation] Conversation not found:", convError);
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already deleted
    if (conversation.deleted_at && !hardDelete) {
      console.log("[inbox-delete-conversation] Conversation already deleted");
      return new Response(
        JSON.stringify({ ok: true, conversationId, message: "Already deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to this tenant
    const { data: tenantUser, error: tenantError } = await supabaseServiceRole
      .from("tenant_users")
      .select("id, role")
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

    console.log(`[inbox-delete-conversation] User ${user.id} has role ${tenantUser.role} in tenant ${conversation.tenant_id}`);

    const now = new Date().toISOString();

    if (hardDelete) {
      // Hard delete: remove messages first, then conversation
      console.log("[inbox-delete-conversation] Performing HARD DELETE");

      // First, get all message IDs for this conversation
      const { data: messageIds } = await supabaseServiceRole
        .from("mt_messages")
        .select("id")
        .eq("conversation_id", conversationId);

      // Delete message reactions if there are messages
      if (messageIds && messageIds.length > 0) {
        const ids = messageIds.map(m => m.id);
        const { error: reactionsError } = await supabaseServiceRole
          .from("message_reactions")
          .delete()
          .in("message_id", ids);

        if (reactionsError) {
          console.warn("[inbox-delete-conversation] Warning deleting reactions:", reactionsError);
          // Continue anyway - might not have any reactions
        }
      }

      // Delete messages
      const { error: msgDeleteError, count: msgCount } = await supabaseServiceRole
        .from("mt_messages")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (msgDeleteError) {
        console.error("[inbox-delete-conversation] Error deleting messages:", msgDeleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete messages", details: msgDeleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[inbox-delete-conversation] Deleted ${msgCount || 0} messages`);

      // Delete conversation drafts
      const { error: draftsError } = await supabaseServiceRole
        .from("conversation_drafts")
        .delete()
        .eq("conversation_id", conversationId);

      if (draftsError) {
        console.warn("[inbox-delete-conversation] Warning deleting drafts:", draftsError);
      }

      // Delete conversation notes
      const { error: notesError } = await supabaseServiceRole
        .from("conversation_notes")
        .delete()
        .eq("conversation_id", conversationId);

      if (notesError) {
        console.warn("[inbox-delete-conversation] Warning deleting notes:", notesError);
      }

      // Delete conversation
      const { error: convDeleteError } = await supabaseServiceRole
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (convDeleteError) {
        console.error("[inbox-delete-conversation] Error deleting conversation:", convDeleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete conversation", details: convDeleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[inbox-delete-conversation] HARD DELETED conversation: ${conversationId}`);
    } else {
      // Soft delete: set deleted_at timestamp
      console.log("[inbox-delete-conversation] Performing SOFT DELETE");

      // Soft delete messages
      const { error: msgUpdateError, count: msgCount } = await supabaseServiceRole
        .from("mt_messages")
        .update({ deleted_at: now })
        .eq("conversation_id", conversationId)
        .eq("tenant_id", conversation.tenant_id)
        .is("deleted_at", null);

      if (msgUpdateError) {
        console.error("[inbox-delete-conversation] Error soft-deleting messages:", msgUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to delete messages", details: msgUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[inbox-delete-conversation] Soft-deleted ${msgCount || 0} messages`);

      // Soft delete conversation
      const { error: convUpdateError } = await supabaseServiceRole
        .from("conversations")
        .update({ deleted_at: now })
        .eq("id", conversationId)
        .eq("tenant_id", conversation.tenant_id);

      if (convUpdateError) {
        console.error("[inbox-delete-conversation] Error soft-deleting conversation:", convUpdateError);
        return new Response(
          JSON.stringify({ error: "Failed to delete conversation", details: convUpdateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[inbox-delete-conversation] SOFT DELETED conversation: ${conversationId}`);
    }

    return new Response(
      JSON.stringify({ ok: true, conversationId, hardDelete }),
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