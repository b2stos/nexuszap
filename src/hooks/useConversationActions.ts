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
 * Soft delete de conversa - arquiva a conversa e suas mensagens
 * A conversa passa para status 'archived' e é removida da lista ativa
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (conversationId: string) => {
      // Soft delete: change status to 'archived'
      const { error } = await supabase
        .from('conversations')
        .update({ 
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
      
      if (error) throw error;
      
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages'] });
      toast.success('Conversa apagada');
    },
    onError: () => {
      toast.error('Erro ao apagar conversa');
    },
  });
}
