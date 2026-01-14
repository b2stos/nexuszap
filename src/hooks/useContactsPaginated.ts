/**
 * useContactsPaginated Hook
 * 
 * Hook for fetching ALL contacts with pagination to bypass Supabase 1000 row limit.
 * Uses multiple fetches to get complete dataset.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Contact {
  id: string;
  phone: string;
  name: string;
  created_at: string;
  user_id: string;
}

const PAGE_SIZE = 1000; // Supabase max per request

/**
 * Fetch ALL contacts by paginating through the entire dataset
 * This bypasses the 1000 row default limit
 */
export function useAllContacts() {
  return useQuery({
    queryKey: ['all-contacts-paginated'],
    queryFn: async () => {
      const allContacts: Contact[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabase
          .from('contacts')
          .select('id, phone, name, created_at, user_id')
          .order('created_at', { ascending: true })
          .range(from, to);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allContacts.push(...(data as Contact[]));
          hasMore = data.length === PAGE_SIZE; // If we got full page, there might be more
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allContacts;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get exact count of contacts (faster than fetching all)
 */
export function useContactsCount() {
  return useQuery({
    queryKey: ['contacts-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch contacts with pagination for display (virtual scrolling)
 */
export function useContactsPage(page: number, pageSize: number = 50, searchTerm: string = '') {
  return useQuery({
    queryKey: ['contacts-page', page, pageSize, searchTerm],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('contacts')
        .select('id, phone, name, created_at, user_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        contacts: (data || []) as Contact[],
        totalCount: count || 0,
        hasMore: data ? data.length === pageSize : false,
      };
    },
  });
}
