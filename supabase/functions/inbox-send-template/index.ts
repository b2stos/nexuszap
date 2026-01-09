/**
 * Edge Function: inbox-send-template
 * 
 * Endpoint para envio de templates pelo Inbox.
 * Usado quando a janela 24h está fechada.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificameProvider } from '../_shared/providers/notificame.ts';
import { Channel, ChannelProviderConfig, TemplateVariable } from '../_shared/providers/types.ts';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface SendTemplateRequest {
  conversation_id: string;
  template_id: string;
  variables: Record<string, string>;
}

interface TemplateData {
  id: string;
  tenant_id: string;
  name: string;
  language: string;
  status: string;
  variables_schema: {
    header?: Array<{ key: string; label: string; required: boolean; type?: string }>;
    body?: Array<{ key: string; label: string; required: boolean; type?: string }>;
    button?: Array<{ key: string; label: string; required: boolean; type?: string }>;
  } | null;
}

interface ConversationData {
  id: string;
  tenant_id: string;
  channel_id: string;
  contact_id: string;
  last_inbound_at: string | null;
  status: string;
  channel: {
    id: string;
    provider_config: ChannelProviderConfig;
    phone_number: string;
  };
  contact: {
    id: string;
    phone: string;
    name: string | null;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only POST allowed
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SendTemplateRequest = await req.json();
    const { conversation_id, template_id, variables } = body;

    // Validate input
    if (!conversation_id || !template_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and template_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inbox-send-template] User ${user.id} sending template ${template_id} to conversation ${conversation_id}`);

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (tenantError || !tenantUser) {
      console.error('[inbox-send-template] Tenant not found:', tenantError);
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from('mt_templates')
      .select('*')
      .eq('id', template_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (templateError || !template) {
      console.error('[inbox-send-template] Template not found:', templateError);
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tpl = template as TemplateData;

    // Check template is approved
    if (tpl.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'template_not_approved', message: 'Template não está aprovado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required variables
    if (tpl.variables_schema) {
      const schema = tpl.variables_schema;
      const allVars = [
        ...(schema.header || []),
        ...(schema.body || []),
        ...(schema.button || []),
      ];
      
      for (const v of allVars) {
        if (v.required && !variables[v.key]?.trim()) {
          return new Response(
            JSON.stringify({ 
              error: 'missing_variable', 
              message: `Variável obrigatória não preenchida: ${v.label || v.key}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get conversation with channel and contact
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        tenant_id,
        channel_id,
        contact_id,
        last_inbound_at,
        status,
        channel:channels(id, provider_config, phone_number),
        contact:mt_contacts(id, phone, name)
      `)
      .eq('id', conversation_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .single();

    if (convError || !conversation) {
      console.error('[inbox-send-template] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const conv = conversation as unknown as ConversationData;

    // Build template variables for provider
    const templateVariables: Record<string, TemplateVariable[]> = {};
    
    if (tpl.variables_schema) {
      const schema = tpl.variables_schema;
      
      if (schema.header?.length) {
        templateVariables.header = schema.header.map(v => ({
          type: (v.type || 'text') as TemplateVariable['type'],
          value: variables[v.key] || '',
        }));
      }
      
      if (schema.body?.length) {
        templateVariables.body = schema.body.map(v => ({
          type: (v.type || 'text') as TemplateVariable['type'],
          value: variables[v.key] || '',
        }));
      }
      
      if (schema.button?.length) {
        templateVariables.button = schema.button.map(v => ({
          type: (v.type || 'text') as TemplateVariable['type'],
          value: variables[v.key] || '',
        }));
      }
    }

    // Create message in database as queued
    const messageContent = `TEMPLATE: ${tpl.name}` + 
      (Object.keys(variables).length > 0 
        ? ` | Variáveis: ${JSON.stringify(variables)}` 
        : '');

    const { data: message, error: msgError } = await supabase
      .from('mt_messages')
      .insert({
        tenant_id: conv.tenant_id,
        conversation_id: conv.id,
        channel_id: conv.channel_id,
        contact_id: conv.contact_id,
        direction: 'outbound',
        type: 'template',
        content: messageContent,
        template_name: tpl.name,
        status: 'queued',
        sent_by_user_id: user.id,
      })
      .select()
      .single();

    if (msgError || !message) {
      console.error('[inbox-send-template] Failed to create message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to create message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inbox-send-template] Message created: ${message.id}`);

    // Build channel object for provider
    const channel: Channel = {
      id: conv.channel.id,
      tenant_id: conv.tenant_id,
      provider_id: '',
      name: '',
      phone_number: conv.channel.phone_number,
      status: 'connected',
      provider_config: conv.channel.provider_config,
    };

    // Send via provider
    let sendResult;
    try {
      sendResult = await notificameProvider.sendTemplate({
        channel,
        to: conv.contact.phone,
        template_name: tpl.name,
        language: tpl.language,
        variables: templateVariables,
      });
    } catch (error) {
      console.error('[inbox-send-template] Provider error:', error);
      
      // Update message as failed
      await supabase
        .from('mt_messages')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_code: 'PROVIDER_ERROR',
          error_detail: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', message.id);

      return new Response(
        JSON.stringify({ 
          error: 'provider_error',
          message: error instanceof Error ? error.message : 'Failed to send template',
          data: { ...message, status: 'failed' },
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!sendResult.success) {
      console.error('[inbox-send-template] Send failed:', sendResult.error);
      
      // Update message as failed
      const { data: failedMessage } = await supabase
        .from('mt_messages')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          error_code: sendResult.error?.code || 'UNKNOWN',
          error_detail: sendResult.error?.detail || 'Failed to send',
        })
        .eq('id', message.id)
        .select()
        .single();

      return new Response(
        JSON.stringify({ 
          error: 'send_failed',
          message: sendResult.error?.detail || 'Failed to send template',
          is_retryable: sendResult.error?.is_retryable ?? true,
          data: failedMessage || { ...message, status: 'failed' },
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message as sent with provider_message_id
    const { data: sentMessage, error: updateError } = await supabase
      .from('mt_messages')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: sendResult.provider_message_id,
      })
      .eq('id', message.id)
      .select()
      .single();

    if (updateError) {
      console.error('[inbox-send-template] Failed to update message status:', updateError);
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: `📋 ${tpl.name}`,
      })
      .eq('id', conversation_id);

    console.log(`[inbox-send-template] Template sent successfully: ${sendResult.provider_message_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: sentMessage || message,
        provider_message_id: sendResult.provider_message_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[inbox-send-template] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
