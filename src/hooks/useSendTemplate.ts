/**
 * useSendTemplate Hook
 * 
 * Hook para envio de templates via Inbox
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InboxMessage } from '@/types/inbox';
import { toast } from 'sonner';

interface SendTemplateParams {
  conversationId: string;
  templateId: string;
  variables: Record<string, string>;
}

interface SendTemplateResponse {
  success: boolean;
  data?: InboxMessage;
  provider_message_id?: string;
  error?: string;
  message?: string;
  is_retryable?: boolean;
}

export function useSendTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conversationId, templateId, variables }: SendTemplateParams): Promise<SendTemplateResponse> => {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Call edge function
      const response = await supabase.functions.invoke('inbox-send-template', {
        body: {
          conversation_id: conversationId,
          template_id: templateId,
          variables,
        },
      });

      // Supabase marks non-2xx as error; we still want the backend payload for friendly UI handling
      if (response.error) {
        const msg = response.error.message || '';
        const idx = msg.indexOf('{');
        if (idx >= 0) {
          try {
            return JSON.parse(msg.slice(idx)) as SendTemplateResponse;
          } catch {
            // fallthrough
          }
        }
        throw new Error(response.error.message || 'Failed to send template');
      }

      return response.data as SendTemplateResponse;
    },
    
    onMutate: async ({ conversationId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['inbox-messages', conversationId] });
      
      // Snapshot previous messages
      const previousMessages = queryClient.getQueryData<InboxMessage[]>(['inbox-messages', conversationId]);
      
      // Optimistic update: add message as "queued"
      const optimisticMessage: InboxMessage = {
        id: `temp-template-${Date.now()}`,
        tenant_id: '',
        conversation_id: conversationId,
        channel_id: '',
        contact_id: '',
        direction: 'outbound',
        type: 'template',
        content: 'Enviando template...',
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
        
        toast.success('Template enviado com sucesso');
      } else {
        // Handle API-level errors
        const errorMessage = data.message || data.error || 'Falha ao enviar template';
        toast.error('Erro ao enviar', { description: errorMessage });
        
        // Update optimistic message to failed or remove
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
      console.error('Send template error:', error);
      toast.error('Erro ao enviar template', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
      
      // Rollback optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(['inbox-messages', conversationId], context.previousMessages);
      }
    },
  });
}
