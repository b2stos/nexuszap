/**
 * useTemplates Hook
 * 
 * Hook para gerenciamento de templates multi-tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface TemplateVariable {
  key: string;
  label: string;
  required: boolean;
  type?: 'text' | 'currency' | 'date_time';
}

export interface TemplateVariablesSchema {
  header?: TemplateVariable[];
  body?: TemplateVariable[];
  button?: TemplateVariable[];
}

export interface Template {
  id: string;
  tenant_id: string;
  provider_id: string;
  name: string;
  language: string;
  category: string;
  status: 'approved' | 'pending' | 'rejected';
  components: unknown;
  variables_schema: TemplateVariablesSchema | null;
  provider_template_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: string;
  status: 'approved' | 'pending' | 'rejected';
  variables_schema?: TemplateVariablesSchema;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

// Get current tenant
export function useCurrentTenantForTemplates() {
  return useQuery({
    queryKey: ['current-tenant-templates'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: tenantUser, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, tenant:tenants(id, name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!tenantUser) throw new Error('No tenant found');
      
      // Get default provider
      const { data: provider } = await supabase
        .from('providers')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      return {
        tenantId: tenantUser.tenant_id,
        providerId: provider?.id || null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// List templates (only meta source)
export function useTemplates(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['templates', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('mt_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('source', 'meta') // Only Meta templates
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []) as Template[];
    },
    enabled: !!tenantId,
  });
}

// List approved templates only (for Inbox and Campaigns)
export function useApprovedTemplates(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['templates-approved', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('mt_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('source', 'meta') // Only Meta templates
        .eq('status', 'approved')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      return (data || []) as Template[];
    },
    enabled: !!tenantId,
  });
}

// Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      providerId, 
      input 
    }: { 
      tenantId: string; 
      providerId: string; 
      input: CreateTemplateInput 
    }) => {
      const { data, error } = await supabase
        .from('mt_templates')
        .insert({
          tenant_id: tenantId,
          provider_id: providerId,
          name: input.name,
          language: input.language,
          category: input.category,
          status: input.status,
          variables_schema: input.variables_schema ? JSON.parse(JSON.stringify(input.variables_schema)) : null,
          components: [],
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Template;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['templates-approved', tenantId] });
      toast.success('Template criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar template', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      input 
    }: { 
      tenantId: string; 
      input: UpdateTemplateInput 
    }) => {
      const { id, variables_schema, ...restUpdates } = input;
      
      const updateData: Record<string, unknown> = {
        ...restUpdates,
        updated_at: new Date().toISOString(),
      };
      
      if (variables_schema !== undefined) {
        updateData.variables_schema = variables_schema ? JSON.parse(JSON.stringify(variables_schema)) : null;
      }
      
      const { data, error } = await supabase
        .from('mt_templates')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Template;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['templates-approved', tenantId] });
      toast.success('Template atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar template', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      templateId 
    }: { 
      tenantId: string; 
      templateId: string 
    }) => {
      const { error } = await supabase
        .from('mt_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['templates', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['templates-approved', tenantId] });
      toast.success('Template excluído com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao excluir template', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}
