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

      const tryParseEdgeError = (msg?: string) => {
        if (!msg) return null;
        const idx = msg.indexOf('{');
        if (idx < 0) return null;
        try {
          return JSON.parse(msg.slice(idx));
        } catch {
          return null;
        }
      };

      // Call edge function
      const response = await supabase.functions.invoke('inbox-send-text', {
        body: {
          conversation_id: conversationId,
          text,
          reply_to_message_id: replyToMessageId,
        },
      });

      // Supabase marks non-2xx as error; we still want to surface the backend payload to the UI
      if (response.error) {
        const parsed = tryParseEdgeError(response.error.message);
        if (parsed) return parsed as SendTextResponse;
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
        
        // Invalidate onboarding status - first message sent
        queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
        // Handle API-level errors
        const errorMessage = data.message || data.error || 'Falha ao enviar mensagem';
        const errorType = data.error;

        if (errorType === 'window_closed') {
          toast.error('Janela de 24h fechada', {
            description: 'Use um template para retomar a conversa.',
          });
        } else if (errorType === 'authentication_error') {
          toast.error('Token NotificaMe inválido', {
            description: 'Vá em Configurações → Canais e reconecte.',
          });
        } else if (errorType === 'channel_not_found') {
          toast.error('Canal não encontrado', {
            description: 'Verifique as configurações do canal.',
          });
        } else if (errorType === 'rate_limited') {
          toast.error('Limite de envio atingido', {
            description: 'Aguarde alguns minutos e tente novamente.',
          });
        } else if (errorType === 'provider_error') {
          toast.error('Erro no provedor', {
            description: 'O NotificaMe está instável. Tentaremos novamente.',
          });
        } else if (errorType === 'missing_token') {
          toast.error('Token não configurado', {
            description: 'Configure o token do NotificaMe no canal.',
          });
        } else if (errorType === 'missing_subscription_id') {
          toast.error('Subscription ID não configurado', {
            description: 'Edite o canal e configure o ID do canal NotificaMe.',
          });
        } else if (errorType === 'token_misconfigured') {
          toast.error('Configuração incorreta do canal', {
            description: 'O Token e Subscription ID estão iguais. Corrija em Configurações → Canais.',
          });
        } else if (errorType === 'Conversation not found') {
          toast.error('Conversa não encontrada', {
            description: 'Esta conversa foi removida ou não existe mais. Atualizando lista...',
          });
          // Invalidate conversations to clear stale data
          queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] });
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

      const tryParseEdgeError = (msg?: string) => {
        if (!msg) return null;
        const idx = msg.indexOf('{');
        if (idx < 0) return null;
        try {
          return JSON.parse(msg.slice(idx));
        } catch {
          return null;
        }
      };

      // Create a new message (don't reuse failed one)
      const response = await supabase.functions.invoke('inbox-send-text', {
        body: {
          conversation_id: conversationId,
          text: originalText,
        },
      });

      if (response.error) {
        const parsed = tryParseEdgeError(response.error.message);
        if (parsed) return parsed as SendTextResponse;
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
