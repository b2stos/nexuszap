/**
 * useConversationActions Hook
 * 
 * Gerencia ações em conversas: resolver, reabrir, atribuir, transferir, apagar
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useResolveConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success('Conversa marcada como resolvida');
    },
    onError: () => {
      toast.error('Erro ao resolver conversa');
    },
  });
}

export function useReopenConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'open' })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success('Conversa reaberta');
    },
    onError: () => {
      toast.error('Erro ao reabrir conversa');
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      userId 
    }: { 
      conversationId: string; 
      userId: string | null 
    }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: userId })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success(userId ? 'Conversa atribuída' : 'Conversa liberada');
    },
    onError: () => {
      toast.error('Erro ao atribuir conversa');
    },
  });
}

export function useAssumeConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: user.id })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success('Você assumiu esta conversa');
    },
    onError: () => {
      toast.error('Erro ao assumir conversa');
    },
  });
}

export function useTogglePinConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      isPinned 
    }: { 
      conversationId: string; 
      isPinned: boolean 
    }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ is_pinned: isPinned })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: (_, { isPinned }) => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      toast.success(isPinned ? 'Conversa fixada' : 'Conversa desfixada');
    },
    onError: () => {
      toast.error('Erro ao fixar conversa');
    },
  });
}

/**
 * Soft delete de conversa - define deleted_at para remover da lista
 * Usa edge function para garantir que mensagens também sejam marcadas
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      conversationId, 
      hardDelete = false 
    }: { 
      conversationId: string; 
      hardDelete?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('inbox-delete-conversation', {
        method: 'DELETE',
        body: { conversationId, hardDelete },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast.success('Conversa apagada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao apagar conversa');
    },
  });
}
