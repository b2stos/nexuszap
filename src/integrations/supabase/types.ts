export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          attempts: number
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          id: string
          last_error: string | null
          next_retry_at: string | null
          provider_message_id: string | null
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_recipient_status"]
          updated_at: string
          variables: Json | null
        }
        Insert: {
          attempts?: number
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          attempts?: number
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_recipient_status"]
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mt_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "mt_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_send_attempts: {
        Row: {
          campaign_id: string | null
          channel_id: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          error_stack: string | null
          failed_count: number | null
          id: string
          provider_response_raw: string | null
          provider_status: number | null
          recipients_count: number | null
          request_payload: Json | null
          step: string
          success_count: number | null
          template_name: string | null
          tenant_id: string | null
          trace_id: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          failed_count?: number | null
          id?: string
          provider_response_raw?: string | null
          provider_status?: number | null
          recipients_count?: number | null
          request_payload?: Json | null
          step?: string
          success_count?: number | null
          template_name?: string | null
          tenant_id?: string | null
          trace_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          failed_count?: number | null
          id?: string
          provider_response_raw?: string | null
          provider_status?: number | null
          recipients_count?: number | null
          request_payload?: Json | null
          step?: string
          success_count?: number | null
          template_name?: string | null
          tenant_id?: string | null
          trace_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_send_attempts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mt_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_send_attempts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_send_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          media_urls: string[] | null
          message_content: string
          name: string
          send_speed: Database["public"]["Enums"]["send_speed"]
          status: Database["public"]["Enums"]["campaign_status"]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          message_content: string
          name: string
          send_speed?: Database["public"]["Enums"]["send_speed"]
          status?: Database["public"]["Enums"]["campaign_status"]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          message_content?: string
          name?: string
          send_speed?: Database["public"]["Enums"]["send_speed"]
          status?: Database["public"]["Enums"]["campaign_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          id: string
          last_connected_at: string | null
          name: string
          phone_number: string | null
          provider_config: Json | null
          provider_id: string
          provider_phone_id: string | null
          quality_rating: string | null
          status: Database["public"]["Enums"]["channel_status"]
          tenant_id: string
          updated_at: string
          verified_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          name: string
          phone_number?: string | null
          provider_config?: Json | null
          provider_id: string
          provider_phone_id?: string | null
          quality_rating?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          tenant_id: string
          updated_at?: string
          verified_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_connected_at?: string | null
          name?: string
          phone_number?: string | null
          provider_config?: Json | null
          provider_id?: string
          provider_phone_id?: string | null
          quality_rating?: string | null
          status?: Database["public"]["Enums"]["channel_status"]
          tenant_id?: string
          updated_at?: string
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          import_batch_id: string | null
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_batch_id?: string | null
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          import_batch_id?: string | null
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_drafts: {
        Row: {
          content: string
          conversation_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          channel_id: string
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "mt_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mt_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          processing_started_at: string | null
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          whatsapp_message_id: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          processing_started_at?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          whatsapp_message_id?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          processing_started_at?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_campaigns: {
        Row: {
          channel_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          name: string
          read_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status_v2"]
          template_id: string
          template_variables: Json | null
          tenant_id: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          name: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status_v2"]
          template_id: string
          template_variables?: Json | null
          tenant_id: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          name?: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status_v2"]
          template_id?: string
          template_variables?: Json | null
          tenant_id?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mt_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_blocked: boolean
          last_interaction_at: string | null
          metadata: Json | null
          name: string | null
          phone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          phone: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_blocked?: boolean
          last_interaction_at?: string | null
          metadata?: Json | null
          name?: string | null
          phone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mt_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_messages: {
        Row: {
          channel_id: string
          contact_id: string
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_code: string | null
          error_detail: string | null
          failed_at: string | null
          id: string
          media_filename: string | null
          media_mime_type: string | null
          media_url: string | null
          provider_message_id: string | null
          read_at: string | null
          reply_to_message_id: string | null
          sent_at: string | null
          sent_by_user_id: string | null
          status: Database["public"]["Enums"]["message_delivery_status"]
          template_name: string | null
          template_variables: Json | null
          tenant_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          channel_id: string
          contact_id: string
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_code?: string | null
          error_detail?: string | null
          failed_at?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: Database["public"]["Enums"]["message_delivery_status"]
          template_name?: string | null
          template_variables?: Json | null
          tenant_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          channel_id?: string
          contact_id?: string
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_code?: string | null
          error_detail?: string | null
          failed_at?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: Database["public"]["Enums"]["message_delivery_status"]
          template_name?: string | null
          template_variables?: Json | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "mt_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "mt_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "mt_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          id: string
          language: string
          name: string
          provider_id: string
          provider_template_id: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["template_status"]
          tenant_id: string
          updated_at: string
          variables_schema: Json | null
        }
        Insert: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          name: string
          provider_id: string
          provider_template_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          tenant_id: string
          updated_at?: string
          variables_schema?: Json | null
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          name?: string
          provider_id?: string
          provider_template_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          tenant_id?: string
          updated_at?: string
          variables_schema?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mt_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mt_webhook_events: {
        Row: {
          channel_id: string | null
          event_type: string
          id: string
          invalid_reason: string | null
          ip_address: string | null
          is_invalid: boolean | null
          message_id: string | null
          payload_raw: Json
          processed: boolean
          processing_error: string | null
          provider: string
          rate_limited: boolean | null
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          channel_id?: string | null
          event_type: string
          id?: string
          invalid_reason?: string | null
          ip_address?: string | null
          is_invalid?: boolean | null
          message_id?: string | null
          payload_raw: Json
          processed?: boolean
          processing_error?: string | null
          provider: string
          rate_limited?: boolean | null
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          channel_id?: string | null
          event_type?: string
          id?: string
          invalid_reason?: string | null
          ip_address?: string | null
          is_invalid?: boolean | null
          message_id?: string | null
          payload_raw?: Json
          processed?: boolean
          processing_error?: string | null
          provider?: string
          rate_limited?: boolean | null
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mt_webhook_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_webhook_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mt_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mt_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opt_outs: {
        Row: {
          created_at: string
          id: string
          opted_out_at: string
          phone: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opted_out_at?: string
          phone: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opted_out_at?: string
          phone?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_outs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      providers: {
        Row: {
          base_url: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["provider_type"]
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          type: Database["public"]["Enums"]["provider_type"]
        }
        Update: {
          base_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["provider_type"]
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          message: string
          shortcut: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          message: string
          shortcut: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          message?: string
          shortcut?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding: {
        Row: {
          channel_connected_at: string | null
          created_at: string
          first_message_sent_at: string | null
          id: string
          inbox_opened_at: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          template_created_at: string | null
          tenant_id: string
          updated_at: string
          welcome_completed_at: string | null
        }
        Insert: {
          channel_connected_at?: string | null
          created_at?: string
          first_message_sent_at?: string | null
          id?: string
          inbox_opened_at?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          template_created_at?: string | null
          tenant_id: string
          updated_at?: string
          welcome_completed_at?: string | null
        }
        Update: {
          channel_connected_at?: string | null
          created_at?: string
          first_message_sent_at?: string | null
          id?: string
          inbox_opened_at?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          template_created_at?: string | null
          tenant_id?: string
          updated_at?: string
          welcome_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["tenant_user_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json | null
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json | null
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      uazapi_config: {
        Row: {
          base_url: string
          created_at: string | null
          id: string
          instance_name: string | null
          instance_token: string
          is_active: boolean | null
          last_connected_at: string | null
          phone_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_url: string
          created_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token: string
          is_active?: boolean | null
          last_connected_at?: string | null
          phone_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_url?: string
          created_at?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          phone_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message_id: string | null
          payload: Json
          phone: string | null
          processed: boolean | null
          status: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message_id?: string | null
          payload: Json
          phone?: string | null
          processed?: boolean | null
          status?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message_id?: string | null
          payload?: Json
          phone?: string | null
          processed?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token_encrypted: string
          business_account_id: string
          created_at: string
          display_phone_number: string | null
          id: string
          last_checked_at: string | null
          phone_number_id: string
          quality_rating: string | null
          status: string
          updated_at: string
          user_id: string
          verified_name: string | null
        }
        Insert: {
          access_token_encrypted: string
          business_account_id: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_checked_at?: string | null
          phone_number_id: string
          quality_rating?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_name?: string | null
        }
        Update: {
          access_token_encrypted?: string
          business_account_id?: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          last_checked_at?: string | null
          phone_number_id?: string
          quality_rating?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          id: string
          language: string
          status: string
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          components: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          template_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tenant_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_user_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_recipient_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "skipped"
      campaign_status:
        | "draft"
        | "sending"
        | "completed"
        | "failed"
        | "cancelled"
      campaign_status_v2:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "done"
        | "cancelled"
      channel_status: "connected" | "disconnected" | "error" | "pending"
      conversation_status: "open" | "resolved" | "archived"
      message_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      message_direction: "inbound" | "outbound"
      message_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "processing"
      message_type:
        | "text"
        | "template"
        | "image"
        | "document"
        | "audio"
        | "video"
        | "sticker"
        | "location"
        | "contact"
        | "system"
      provider_type: "official_bsp" | "unofficial"
      send_speed: "slow" | "normal" | "fast"
      template_status: "approved" | "pending" | "rejected"
      tenant_status: "active" | "inactive" | "suspended"
      tenant_user_role: "owner" | "admin" | "agent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      campaign_recipient_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
        "skipped",
      ],
      campaign_status: ["draft", "sending", "completed", "failed", "cancelled"],
      campaign_status_v2: [
        "draft",
        "scheduled",
        "running",
        "paused",
        "done",
        "cancelled",
      ],
      channel_status: ["connected", "disconnected", "error", "pending"],
      conversation_status: ["open", "resolved", "archived"],
      message_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "failed",
        "processing",
      ],
      message_type: [
        "text",
        "template",
        "image",
        "document",
        "audio",
        "video",
        "sticker",
        "location",
        "contact",
        "system",
      ],
      provider_type: ["official_bsp", "unofficial"],
      send_speed: ["slow", "normal", "fast"],
      template_status: ["approved", "pending", "rejected"],
      tenant_status: ["active", "inactive", "suspended"],
      tenant_user_role: ["owner", "admin", "agent"],
    },
  },
} as const
