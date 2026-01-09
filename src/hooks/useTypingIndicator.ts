/**
 * useTypingIndicator Hook
 * 
 * Gerencia indicador de digitação interno (não enviado ao cliente)
 * Usa broadcast channel do Supabase Realtime
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingUser {
  id: string;
  name: string;
  email: string;
}

interface TypingState {
  [conversationId: string]: TypingUser[];
}

export function useTypingIndicator(
  tenantId: string | undefined,
  conversationId: string | undefined,
  currentUser: { id: string; name?: string; email: string } | null
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastTypingBroadcast = useRef<number>(0);
  
  // Broadcast typing event
  const broadcastTyping = useCallback(() => {
    if (!tenantId || !conversationId || !currentUser) return;
    
    // Throttle: Only broadcast every 2 seconds
    const now = Date.now();
    if (now - lastTypingBroadcast.current < 2000) return;
    lastTypingBroadcast.current = now;
    
    const channel = supabase.channel(`typing-${tenantId}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversationId,
        user: {
          id: currentUser.id,
          name: currentUser.name || currentUser.email.split('@')[0],
          email: currentUser.email,
        }
      }
    });
  }, [tenantId, conversationId, currentUser]);
  
  // Stop typing broadcast
  const stopTyping = useCallback(() => {
    if (!tenantId || !conversationId || !currentUser) return;
    
    const channel = supabase.channel(`typing-${tenantId}`);
    channel.send({
      type: 'broadcast',
      event: 'stop-typing',
      payload: {
        conversationId,
        userId: currentUser.id,
      }
    });
  }, [tenantId, conversationId, currentUser]);
  
  // Subscribe to typing events
  useEffect(() => {
    if (!tenantId || !conversationId) return;
    
    const channelName = `typing-${tenantId}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.conversationId !== conversationId) return;
        if (payload.user.id === currentUser?.id) return; // Ignore self
        
        setTypingUsers(prev => {
          // Add or update typing user
          const existing = prev.find(u => u.id === payload.user.id);
          if (existing) return prev;
          return [...prev, payload.user];
        });
        
        // Clear typing after 3 seconds of no updates
        const existingTimeout = typingTimeoutRef.current.get(payload.user.id);
        if (existingTimeout) clearTimeout(existingTimeout);
        
        const timeout = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.id !== payload.user.id));
          typingTimeoutRef.current.delete(payload.user.id);
        }, 3000);
        
        typingTimeoutRef.current.set(payload.user.id, timeout);
      })
      .on('broadcast', { event: 'stop-typing' }, ({ payload }) => {
        if (payload.conversationId !== conversationId) return;
        
        setTypingUsers(prev => prev.filter(u => u.id !== payload.userId));
        
        const timeout = typingTimeoutRef.current.get(payload.userId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutRef.current.delete(payload.userId);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
      
      // Clear all timeouts
      typingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutRef.current.clear();
    };
  }, [tenantId, conversationId, currentUser?.id]);
  
  // Clear typing users when conversation changes
  useEffect(() => {
    setTypingUsers([]);
  }, [conversationId]);
  
  return {
    typingUsers,
    broadcastTyping,
    stopTyping,
    isAnyoneTyping: typingUsers.length > 0,
    typingText: typingUsers.length === 1
      ? `${typingUsers[0].name} está digitando...`
      : typingUsers.length > 1
        ? `${typingUsers.length} pessoas digitando...`
        : null,
  };
}
