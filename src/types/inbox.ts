/**
 * Inbox Types
 * 
 * Tipos para o Inbox multi-tenant
 */

export interface InboxContact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url?: string | null;
  last_interaction_at: string | null;
}

export interface InboxConversation {
  id: string;
  tenant_id: string;
  channel_id: string;
  contact_id: string;
  status: 'open' | 'resolved' | 'archived';
  assigned_user_id: string | null;
  unread_count: number;
  is_pinned: boolean;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  contact?: InboxContact;
  channel?: {
    id: string;
    name: string;
    phone_number: string | null;
  };
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contact' | 'template' | 'system';
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface InboxMessage {
  id: string;
  tenant_id: string;
  conversation_id: string;
  channel_id: string;
  contact_id: string;
  direction: MessageDirection;
  type: MessageType;
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  template_name: string | null;
  provider_message_id: string | null;
  status: MessageStatus;
  error_code: string | null;
  error_detail: string | null;
  reply_to_message_id: string | null;
  sent_by_user_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
}

export interface ConversationFilter {
  search: string;
  unreadOnly: boolean;
  status?: 'open' | 'resolved' | 'all';
  repliedOnly?: boolean; // Apenas conversas onde o contato respondeu
}

export interface WindowStatus {
  isOpen: boolean;
  remainingMs: number;
  remainingFormatted: string;
  closesAt: Date | null;
}
