/**
 * useInboxDrafts Hook
 * 
 * Gerencia rascunhos de mensagens por conversa
 * Salva automaticamente quando o usuário troca de conversa
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Draft {
  conversationId: string;
  content: string;
  updatedAt: Date;
}

// Local storage key for fallback
const DRAFTS_STORAGE_KEY = 'inbox-drafts';

// Load drafts from local storage as fallback
function loadLocalDrafts(): Map<string, string> {
  try {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, string>;
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error('Error loading drafts from localStorage:', e);
  }
  return new Map();
}

// Save drafts to local storage
function saveLocalDrafts(drafts: Map<string, string>) {
  try {
    const obj = Object.fromEntries(drafts);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('Error saving drafts to localStorage:', e);
  }
}

export function useInboxDrafts() {
  const queryClient = useQueryClient();
  const [localDrafts, setLocalDrafts] = useState<Map<string, string>>(() => loadLocalDrafts());
  const pendingSave = useRef<{ conversationId: string; content: string } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Save draft mutation (debounced to DB)
  const saveDraftMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      if (content.trim()) {
        // Upsert draft
        const { error } = await supabase
          .from('conversation_drafts')
          .upsert({
            conversation_id: conversationId,
            user_id: user.id,
            content: content.trim(),
          }, {
            onConflict: 'conversation_id,user_id'
          });
        
        if (error) throw error;
      } else {
        // Delete draft if empty
        const { error } = await supabase
          .from('conversation_drafts')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', user.id);
        
        if (error && error.code !== 'PGRST116') throw error; // Ignore not found
      }
    },
    onError: (error) => {
      console.error('Error saving draft:', error);
    }
  });
  
  // Get draft for a conversation
  const getDraft = useCallback((conversationId: string): string => {
    return localDrafts.get(conversationId) || '';
  }, [localDrafts]);
  
  // Set draft for a conversation (immediate local update + debounced DB save)
  const setDraft = useCallback((conversationId: string, content: string) => {
    // Update local state immediately
    setLocalDrafts(prev => {
      const updated = new Map(prev);
      if (content.trim()) {
        updated.set(conversationId, content);
      } else {
        updated.delete(conversationId);
      }
      saveLocalDrafts(updated);
      return updated;
    });
    
    // Debounce DB save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    pendingSave.current = { conversationId, content };
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingSave.current) {
        saveDraftMutation.mutate(pendingSave.current);
        pendingSave.current = null;
      }
    }, 1000); // Save after 1 second of inactivity
  }, [saveDraftMutation]);
  
  // Clear draft when message is sent
  const clearDraft = useCallback((conversationId: string) => {
    setLocalDrafts(prev => {
      const updated = new Map(prev);
      updated.delete(conversationId);
      saveLocalDrafts(updated);
      return updated;
    });
    
    // Clear from DB immediately
    saveDraftMutation.mutate({ conversationId, content: '' });
  }, [saveDraftMutation]);
  
  // Load drafts from DB on mount
  useEffect(() => {
    const loadDrafts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('conversation_drafts')
        .select('conversation_id, content')
        .eq('user_id', user.id);
      
      if (!error && data) {
        const dbDrafts = new Map<string, string>();
        data.forEach(d => dbDrafts.set(d.conversation_id, d.content));
        
        // Merge with local drafts (local takes precedence for recent changes)
        setLocalDrafts(prev => {
          const merged = new Map(dbDrafts);
          prev.forEach((value, key) => {
            merged.set(key, value);
          });
          saveLocalDrafts(merged);
          return merged;
        });
      }
    };
    
    loadDrafts();
  }, []);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Save any pending draft
      if (pendingSave.current) {
        saveDraftMutation.mutate(pendingSave.current);
      }
    };
  }, []);
  
  return {
    getDraft,
    setDraft,
    clearDraft,
    hasDraft: useCallback((conversationId: string) => !!localDrafts.get(conversationId)?.trim(), [localDrafts]),
  };
}
