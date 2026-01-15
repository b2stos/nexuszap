/**
 * useConversationActions Hook
 * 
 * Gerencia ações em conversas: resolver, reabrir, atribuir, transferir, apagar
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { InboxConversation, InboxMessage } from '@/types/inbox';
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
 * Usa backend function para garantir que mensagens também sejam marcadas
 * 
 * Requisitos:
 * - Optimistic UI: remove da lista imediatamente
 * - Rollback em erro: volta a conversa
 * - Toast com detalhes reais do erro (status + body quando disponível)
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  const formatInvokeError = (err: unknown) => {
    const anyErr = err as any;
    const status = anyErr?.context?.status;
    const body = anyErr?.context?.body;

    let bodyText = '';
    if (typeof body === 'string') {
      bodyText = body;
    } else if (body) {
      try {
        bodyText = JSON.stringify(body);
      } catch {
        bodyText = String(body);
      }
    }

    const baseMessage = anyErr?.message || 'Erro ao apagar conversa';

    if (status) {
      // Prefer a clear API error message if present
      const parsedMessage = (() => {
        if (typeof body === 'object' && body?.error) return String(body.error);
        try {
          const parsed = typeof bodyText === 'string' ? JSON.parse(bodyText) : null;
          if (parsed?.error) return String(parsed.error);
        } catch {
          // ignore
        }
        return '';
      })();

      const details = parsedMessage || bodyText;
      return details ? `HTTP ${status}: ${details}` : `HTTP ${status}: ${baseMessage}`;
    }

    return baseMessage;
  };

  return useMutation<
    string,
    Error,
    { conversationId: string; hardDelete?: boolean },
    {
      conversationQuerySnapshots: Array<{
        queryKey: unknown[];
        data: InboxConversation[] | undefined;
      }>;
      messagesSnapshot: InboxMessage[] | undefined;
    }
  >({
    mutationFn: async ({ conversationId, hardDelete = false }) => {
      console.log(`[useDeleteConversation] Deleting conversation: ${conversationId}, hardDelete: ${hardDelete}`);
      
      // Use POST instead of DELETE for better Safari/iPad compatibility
      const { data, error } = await supabase.functions.invoke('inbox-delete-conversation', {
        method: 'POST',
        body: { conversationId, hardDelete },
      });

      console.log('[useDeleteConversation] Response:', { data, error });

      if (error) {
        console.error('[useDeleteConversation] Invoke error:', error);
        throw error as unknown as Error;
      }
      if (data?.error) {
        console.error('[useDeleteConversation] API error:', data.error);
        throw new Error(data.error);
      }

      return data?.conversationId || conversationId;
    },
    onMutate: async ({ conversationId }) => {
      await queryClient.cancelQueries({ queryKey: ['inbox-conversations'] });
      await queryClient.cancelQueries({ queryKey: ['inbox-messages', conversationId] });

      // Snapshot all conversation list caches (tenantId + filter variants)
      const conversationQueries = queryClient.getQueriesData<InboxConversation[]>({
        queryKey: ['inbox-conversations'],
      });

      const conversationQuerySnapshots = conversationQueries.map(([queryKey, data]) => ({
        queryKey: queryKey as unknown[],
        data,
      }));

      // Optimistic: remove from all cached conversation lists
      conversationQueries.forEach(([queryKey]) => {
        queryClient.setQueryData<InboxConversation[]>(queryKey, (old) =>
          old ? old.filter((c) => c.id !== conversationId) : old
        );
      });

      // Optimistic: clear messages cache for this conversation
      const messagesKey = ['inbox-messages', conversationId] as const;
      const messagesSnapshot = queryClient.getQueryData<InboxMessage[]>(messagesKey);
      queryClient.setQueryData<InboxMessage[]>(messagesKey, []);

      return { conversationQuerySnapshots, messagesSnapshot };
    },
    onSuccess: () => {
      toast.success('Conversa apagada');
    },
    onError: (err, variables, context) => {
      // Rollback caches
      context?.conversationQuerySnapshots.forEach(({ queryKey, data }) => {
        queryClient.setQueryData(queryKey, data);
      });

      if (context) {
        queryClient.setQueryData(['inbox-messages', variables.conversationId], context.messagesSnapshot);
      }

      toast.error(formatInvokeError(err));
    },
    onSettled: (_data, _error, variables) => {
      // Ensure backend truth wins
      queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-messages', variables.conversationId] });
    },
  });
}
