/**
 * useQuickReplies Hook
 * 
 * Gerencia respostas rápidas (/obrigado, /bomdia, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface QuickReply {
  id: string;
  tenant_id: string;
  shortcut: string;
  title: string;
  message: string;
  created_at: string;
}

export function useQuickReplies(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['quick-replies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('shortcut', { ascending: true });
      
      if (error) throw error;
      return data as QuickReply[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateQuickReply(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reply: { shortcut: string; title: string; message: string }) => {
      if (!tenantId) throw new Error('No tenant');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Normalize shortcut (add / if not present)
      const shortcut = reply.shortcut.startsWith('/') 
        ? reply.shortcut.toLowerCase() 
        : `/${reply.shortcut.toLowerCase()}`;
      
      const { data, error } = await supabase
        .from('quick_replies')
        .insert({
          tenant_id: tenantId,
          shortcut,
          title: reply.title,
          message: reply.message,
          created_by_user_id: user.id,
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error('Este atalho já existe');
        }
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] });
      toast.success('Resposta rápida criada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar resposta rápida');
    },
  });
}

export function useUpdateQuickReply(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reply: { id: string; shortcut?: string; title?: string; message?: string }) => {
      const updates: Record<string, string> = {};
      
      if (reply.shortcut) {
        updates.shortcut = reply.shortcut.startsWith('/') 
          ? reply.shortcut.toLowerCase() 
          : `/${reply.shortcut.toLowerCase()}`;
      }
      if (reply.title) updates.title = reply.title;
      if (reply.message) updates.message = reply.message;
      
      const { error } = await supabase
        .from('quick_replies')
        .update(updates)
        .eq('id', reply.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] });
      toast.success('Resposta rápida atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar resposta rápida');
    },
  });
}

export function useDeleteQuickReply(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick-replies', tenantId] });
      toast.success('Resposta rápida removida');
    },
    onError: () => {
      toast.error('Erro ao remover resposta rápida');
    },
  });
}

// Hook to find a quick reply by shortcut
export function useFindQuickReply(
  quickReplies: QuickReply[], 
  text: string
): QuickReply | null {
  if (!text.startsWith('/')) return null;
  
  const shortcut = text.split(' ')[0].toLowerCase();
  return quickReplies.find(qr => qr.shortcut === shortcut) || null;
}
