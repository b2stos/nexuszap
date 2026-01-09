/**
 * useInbox Hook
 * 
 * Gerencia estado e queries do Inbox multi-tenant
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  InboxConversation, 
  InboxMessage, 
  InboxContact,
  ConversationFilter,
  WindowStatus 
} from '@/types/inbox';
import { toast } from 'sonner';

// ============================================
// TENANT HOOK
// ============================================

export function useCurrentTenant() {
  return useQuery({
    queryKey: ['current-tenant'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Buscar tenant do usuário
      const { data: tenantUser, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, role, tenant:tenants(id, name, slug)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!tenantUser) throw new Error('No tenant found for user');
      
      return {
        tenantId: tenantUser.tenant_id,
        role: tenantUser.role as 'owner' | 'admin' | 'agent',
        tenant: tenantUser.tenant as { id: string; name: string; slug: string },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// CONVERSATIONS HOOK
// ============================================

export function useConversations(tenantId: string | undefined, filter: ConversationFilter) {
  return useQuery({
    queryKey: ['inbox-conversations', tenantId, filter],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contact:mt_contacts(id, name, phone, avatar_url, last_interaction_at),
          channel:channels(id, name, phone_number)
        `)
        .eq('tenant_id', tenantId)
        .order('is_pinned', { ascending: false })
        .order('last_message_at', { ascending: false, nullsFirst: false });
      
      // Filtro de não lidas
      if (filter.unreadOnly) {
        query = query.gt('unread_count', 0);
      }
      
      // Filtro de status
      if (filter.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filtro de busca (client-side para simplicidade)
      let conversations = (data || []) as unknown as InboxConversation[];
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        conversations = conversations.filter(conv => {
          const contactName = conv.contact?.name?.toLowerCase() || '';
          const contactPhone = conv.contact?.phone || '';
          return contactName.includes(searchLower) || contactPhone.includes(filter.search);
        });
      }
      
      return conversations;
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Polling a cada 5s
  });
}

// ============================================
// MESSAGES HOOK
// ============================================

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['inbox-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('mt_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      return (data || []) as InboxMessage[];
    },
    enabled: !!conversationId,
    refetchInterval: 3000, // Polling a cada 3s para conversa ativa
  });
}

// ============================================
// CONTACT HOOK
// ============================================

export function useContact(contactId: string | undefined) {
  return useQuery({
    queryKey: ['inbox-contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      
      const { data, error } = await supabase
        .from('mt_contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();
      
      if (error) throw error;
      
      return data as InboxContact | null;
    },
    enabled: !!contactId,
  });
}

// ============================================
// MARK AS READ
// ============================================

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: (_, conversationId) => {
      // Atualizar cache local
      queryClient.setQueryData(
        ['inbox-conversations'],
        (old: InboxConversation[] | undefined) => {
          if (!old) return old;
          return old.map(conv => 
            conv.id === conversationId 
              ? { ...conv, unread_count: 0 }
              : conv
          );
        }
      );
    },
  });
}

// ============================================
// REALTIME SUBSCRIPTION
// ============================================

export function useInboxRealtime(
  tenantId: string | undefined,
  activeConversationId: string | undefined,
  onNewMessage?: () => void,
  onConversationUpdate?: () => void
) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!tenantId) return;
    
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('inbox-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mt_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[Inbox] New message:', payload);
          
          // Invalidar queries
          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
          
          if (activeConversationId && payload.new.conversation_id === activeConversationId) {
            queryClient.invalidateQueries({ queryKey: ['inbox-messages', activeConversationId] });
          }
          
          onNewMessage?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mt_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[Inbox] Message updated:', payload);
          
          if (activeConversationId && payload.new.conversation_id === activeConversationId) {
            queryClient.invalidateQueries({ queryKey: ['inbox-messages', activeConversationId] });
          }
        }
      )
      .subscribe();
    
    // Subscribe to conversation updates
    const conversationsChannel = supabase
      .channel('inbox-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[Inbox] Conversation update:', payload);
          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
          onConversationUpdate?.();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [tenantId, activeConversationId, queryClient, onNewMessage, onConversationUpdate]);
}

// ============================================
// 24H WINDOW HELPER
// ============================================

export function calculate24hWindow(lastInboundAt: string | null): WindowStatus {
  if (!lastInboundAt) {
    return {
      isOpen: false,
      remainingMs: 0,
      remainingFormatted: 'Janela fechada',
      closesAt: null,
    };
  }
  
  const lastInbound = new Date(lastInboundAt);
  const windowEnd = new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const remainingMs = Math.max(0, windowEnd.getTime() - now.getTime());
  
  if (remainingMs <= 0) {
    return {
      isOpen: false,
      remainingMs: 0,
      remainingFormatted: 'Janela fechada',
      closesAt: windowEnd,
    };
  }
  
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  
  return {
    isOpen: true,
    remainingMs,
    remainingFormatted: `${hours}h ${minutes}m restantes`,
    closesAt: windowEnd,
  };
}
