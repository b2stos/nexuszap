/**
 * useSendMessage Hook
 * 
 * Hook para envio de mensagens via Inbox com atualização otimista
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InboxMessage } from '@/types/inbox';
import { toast } from 'sonner';

interface SendTextParams {
  conversationId: string;
  text: string;
  replyToMessageId?: string;
}

interface SendTextResponse {
  success: boolean;
  data?: InboxMessage;
  provider_message_id?: string;
  error?: string;
  message?: string;
  is_retryable?: boolean;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, text, replyToMessageId }: SendTextParams): Promise<SendTextResponse> => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Call edge function
      const response = await supabase.functions.invoke('inbox-send-text', {
        body: {
          conversation_id: conversationId,
          text,
          reply_to_message_id: replyToMessageId,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to send message');
      }
      
      return response.data as SendTextResponse;
    },
    
    onMutate: async ({ conversationId, text }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['inbox-messages', conversationId] });
      
      // Snapshot previous messages
      const previousMessages = queryClient.getQueryData<InboxMessage[]>(['inbox-messages', conversationId]);
      
      // Optimistic update: add message as "queued"
      const optimisticMessage: InboxMessage = {
        id: `temp-${Date.now()}`,
        tenant_id: '',
        conversation_id: conversationId,
        channel_id: '',
        contact_id: '',
        direction: 'outbound',
        type: 'text',
        content: text,
        status: 'queued',
        created_at: new Date().toISOString(),
        provider_message_id: null,
        media_url: null,
        media_mime_type: null,
        media_filename: null,
        template_name: null,
        sent_by_user_id: null,
        sent_at: null,
        delivered_at: null,
        read_at: null,
        failed_at: null,
        error_code: null,
        error_detail: null,
        reply_to_message_id: null,
      };
      
      queryClient.setQueryData<InboxMessage[]>(
        ['inbox-messages', conversationId],
        (old) => [...(old || []), optimisticMessage]
      );
      
      return { previousMessages, optimisticMessageId: optimisticMessage.id };
    },
    
    onSuccess: (data, { conversationId }, context) => {
      if (data.success && data.data) {
        // Replace optimistic message with real one
        queryClient.setQueryData<InboxMessage[]>(
          ['inbox-messages', conversationId],
          (old) => {
            if (!old) return [data.data!];
            
            return old.map((msg) =>
              msg.id === context?.optimisticMessageId ? data.data! : msg
            );
          }
        );
        
        // Invalidate conversations to update last_message_preview
        queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      } else {
        // Handle API-level errors
        const errorMessage = data.message || data.error || 'Falha ao enviar mensagem';
        
        if (data.error === 'window_closed') {
          toast.error('Janela de 24h fechada', {
            description: 'Use um template para retomar a conversa.',
          });
        } else {
          toast.error('Erro ao enviar', { description: errorMessage });
        }
        
        // Update optimistic message to failed
        if (data.data) {
          queryClient.setQueryData<InboxMessage[]>(
            ['inbox-messages', conversationId],
            (old) => {
              if (!old) return [];
              return old.map((msg) =>
                msg.id === context?.optimisticMessageId ? data.data! : msg
              );
            }
          );
        } else {
          // Remove optimistic message
          queryClient.setQueryData<InboxMessage[]>(
            ['inbox-messages', conversationId],
            (old) => old?.filter((msg) => msg.id !== context?.optimisticMessageId) || []
          );
        }
      }
    },
    
    onError: (error, { conversationId }, context) => {
      console.error('Send message error:', error);
      toast.error('Erro ao enviar mensagem', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
      
      // Rollback optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(['inbox-messages', conversationId], context.previousMessages);
      }
    },
  });
}

// Hook for retrying failed messages
export function useRetryMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, originalText }: { conversationId: string; originalText: string }): Promise<SendTextResponse> => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Create a new message (don't reuse failed one)
      const response = await supabase.functions.invoke('inbox-send-text', {
        body: {
          conversation_id: conversationId,
          text: originalText,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to retry message');
      }
      
      return response.data as SendTextResponse;
    },
    
    onSuccess: (data, { conversationId }) => {
      if (data.success) {
        toast.success('Mensagem reenviada');
        // Invalidate to refresh messages
        queryClient.invalidateQueries({ queryKey: ['inbox-messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
      } else {
        toast.error('Falha ao reenviar', {
          description: data.message || 'Tente novamente',
        });
      }
    },
    
    onError: (error) => {
      toast.error('Erro ao reenviar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}
