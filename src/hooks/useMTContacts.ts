/**
 * useMTContacts Hook
 * 
 * Hook para gerenciamento de contatos multi-tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MTContact {
  id: string;
  tenant_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown> | null;
  is_blocked: boolean;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
}

// Get current tenant
export function useCurrentTenantForContacts() {
  return useQuery({
    queryKey: ['current-tenant-contacts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: tenantUser, error } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!tenantUser) throw new Error('No tenant found');
      
      return { tenantId: tenantUser.tenant_id };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// List contacts
export function useMTContacts(tenantId: string | undefined, options?: { limit?: number }) {
  return useQuery({
    queryKey: ['mt-contacts', tenantId, options?.limit],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('mt_contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_blocked', false)
        .order('name', { ascending: true, nullsFirst: false });
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []) as MTContact[];
    },
    enabled: !!tenantId,
  });
}

// Count contacts
export function useMTContactsCount(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['mt-contacts-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      const { count, error } = await supabase
        .from('mt_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_blocked', false);
      
      if (error) throw error;
      
      return count || 0;
    },
    enabled: !!tenantId,
  });
}

// Create contact
export function useCreateMTContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      phone,
      name,
      email,
    }: { 
      tenantId: string; 
      phone: string;
      name?: string;
      email?: string;
    }) => {
      // Normalize phone
      const normalizedPhone = phone.replace(/\D/g, '');
      
      const { data, error } = await supabase
        .from('mt_contacts')
        .insert({
          tenant_id: tenantId,
          phone: normalizedPhone,
          name: name || null,
          email: email || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as MTContact;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['mt-contacts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['mt-contacts-count', tenantId] });
      toast.success('Contato criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar contato', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Import contacts in bulk
export function useImportMTContacts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      contacts,
    }: { 
      tenantId: string; 
      contacts: Array<{ phone: string; name?: string; email?: string }>;
    }) => {
      // Normalize and dedupe
      const seen = new Set<string>();
      const validContacts = contacts
        .map(c => ({
          tenant_id: tenantId,
          phone: c.phone.replace(/\D/g, ''),
          name: c.name || null,
          email: c.email || null,
        }))
        .filter(c => {
          if (!c.phone || c.phone.length < 10) return false;
          if (seen.has(c.phone)) return false;
          seen.add(c.phone);
          return true;
        });
      
      if (validContacts.length === 0) {
        throw new Error('Nenhum contato válido para importar');
      }
      
      // Upsert in batches
      const BATCH_SIZE = 500;
      let imported = 0;
      
      for (let i = 0; i < validContacts.length; i += BATCH_SIZE) {
        const batch = validContacts.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('mt_contacts')
          .upsert(batch, {
            onConflict: 'tenant_id,phone',
            ignoreDuplicates: false,
          });
        
        if (error) {
          console.error('Batch import error:', error);
        } else {
          imported += batch.length;
        }
      }
      
      return { imported, total: validContacts.length };
    },
    onSuccess: ({ imported }, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['mt-contacts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['mt-contacts-count', tenantId] });
      toast.success(`${imported} contatos importados`);
    },
    onError: (error) => {
      toast.error('Erro ao importar contatos', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}
