/**
 * useContactsPaginated Hook
 * 
 * Hook for fetching mt_contacts (multi-tenant) with pagination.
 * Uses tenant isolation for proper data access.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  created_at: string;
  tenant_id: string;
}

const PAGE_SIZE = 1000; // Supabase max per request

/**
 * Get current user's tenant ID
 */
async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: tenantUser, error } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  
  if (error || !tenantUser) return null;
  return tenantUser.tenant_id;
}

/**
 * Fetch ALL contacts from mt_contacts by paginating through the entire dataset
 * This bypasses the 1000 row default limit
 */
export function useAllContacts() {
  return useQuery({
    queryKey: ['all-contacts-paginated'],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return [];
      
      const allContacts: Contact[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabase
          .from('mt_contacts')
          .select('id, phone, name, email, created_at, tenant_id')
          .eq('tenant_id', tenantId)
          .eq('is_blocked', false)
          .order('created_at', { ascending: true })
          .range(from, to);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allContacts.push(...(data as Contact[]));
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allContacts;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Get exact count of contacts from mt_contacts
 */
export function useContactsCount() {
  return useQuery({
    queryKey: ['contacts-count'],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) return 0;
      
      const { count, error } = await supabase
        .from('mt_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_blocked', false);
      
      if (error) throw error;
      return count || 0;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch contacts from mt_contacts with pagination for display
 */
export function useContactsPage(page: number, pageSize: number = 50, searchTerm: string = '') {
  return useQuery({
    queryKey: ['contacts-page', page, pageSize, searchTerm],
    queryFn: async () => {
      const tenantId = await getCurrentTenantId();
      if (!tenantId) {
        return { contacts: [], totalCount: 0, hasMore: false };
      }
      
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('mt_contacts')
        .select('id, phone, name, email, created_at, tenant_id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('is_blocked', false)
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
