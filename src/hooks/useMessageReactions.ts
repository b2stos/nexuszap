/**
 * useMessageReactions Hook
 * 
 * Gerencia reações internas a mensagens (visual only, não enviadas ao cliente)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export function useMessageReactions(messageIds: string[]) {
  return useQuery({
    queryKey: ['message-reactions', messageIds],
    queryFn: async () => {
      if (messageIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', messageIds);
      
      if (error) throw error;
      return data as MessageReaction[];
    },
    enabled: messageIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        // Remove reaction
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
        
        return { action: 'removed' as const };
      } else {
        // Add reaction
        await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji,
          });
        
        return { action: 'added' as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-reactions'] });
    },
  });
}

// Helper to group reactions by emoji
export function groupReactionsByEmoji(
  reactions: MessageReaction[], 
  messageId: string
): Map<string, { userId: string; userName?: string }[]> {
  const groups = new Map<string, { userId: string; userName?: string }[]>();
  
  reactions
    .filter(r => r.message_id === messageId)
    .forEach(r => {
      const existing = groups.get(r.emoji) || [];
      groups.set(r.emoji, [...existing, { userId: r.user_id }]);
    });
  
  return groups;
}
