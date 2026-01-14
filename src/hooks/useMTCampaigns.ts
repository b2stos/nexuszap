/**
 * useMTCampaigns Hook
 * 
 * Hook para gerenciamento de campanhas multi-tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface MTCampaign {
  id: string;
  tenant_id: string;
  channel_id: string;
  template_id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'done' | 'cancelled';
  template_variables: Record<string, string> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  template?: {
    id: string;
    name: string;
    language: string;
    status: string;
    variables_schema: unknown;
  };
  channel?: {
    id: string;
    name: string;
    phone_number: string | null;
    status: string;
  };
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';
  variables: Record<string, string> | null;
  attempts: number;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: {
    id: string;
    phone: string;
    name: string | null;
  };
}

export interface CreateCampaignInput {
  name: string;
  channel_id: string;
  template_id: string;
  template_variables?: Record<string, string>;
  contact_ids: string[];
  scheduled_at?: string;
}

// Get current tenant
export function useCurrentTenantForCampaigns() {
  return useQuery({
    queryKey: ['current-tenant-campaigns'],
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
      
      return {
        tenantId: tenantUser.tenant_id,
        userId: user.id,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// List campaigns
export function useMTCampaigns(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['mt-campaigns', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('mt_campaigns')
        .select(`
          *,
          template:mt_templates(id, name, language, status, variables_schema),
          channel:channels(id, name, phone_number, status)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []) as MTCampaign[];
    },
    enabled: !!tenantId,
    refetchInterval: 10000, // Refresh every 10s for running campaigns
  });
}

// Get single campaign
export function useMTCampaign(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['mt-campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      
      const { data, error } = await supabase
        .from('mt_campaigns')
        .select(`
          *,
          template:mt_templates(id, name, language, status, variables_schema),
          channel:channels(id, name, phone_number, status)
        `)
        .eq('id', campaignId)
        .single();
      
      if (error) throw error;
      
      return data as MTCampaign;
    },
    enabled: !!campaignId,
    refetchInterval: (query) => {
      // Refresh more frequently when running
      if (query.state.data?.status === 'running') return 3000;
      return false;
    },
  });
}

// Get campaign recipients
export function useCampaignRecipients(campaignId: string | undefined, filterStatus?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped') {
  return useQuery({
    queryKey: ['campaign-recipients', campaignId, filterStatus],
    queryFn: async () => {
      if (!campaignId) return [];
      
      let query = supabase
        .from('campaign_recipients')
        .select(`
          *,
          contact:mt_contacts(id, phone, name)
        `)
        .eq('campaign_id', campaignId)
        .order('updated_at', { ascending: false });
      
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      
      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      
      return (data || []) as CampaignRecipient[];
    },
    enabled: !!campaignId,
    // Refresh recipients when campaign is running
    refetchInterval: 5000,
  });
}

// Create campaign (draft only - no recipients inserted here)
// Recipients are inserted by campaign-start edge function when starting
export function useCreateMTCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      tenantId, 
      userId,
      input 
    }: { 
      tenantId: string; 
      userId: string;
      input: CreateCampaignInput;
    }) => {
      console.log('[useCreateMTCampaign] Creating campaign:', input.name);
      console.log('[useCreateMTCampaign] Contact IDs count:', input.contact_ids?.length || 0);
      
      // Create campaign as draft
      // Note: We store total_recipients as the expected count,
      // but actual recipients are inserted when campaign starts via campaign-start edge function
      const { data: campaign, error: campaignError } = await supabase
        .from('mt_campaigns')
        .insert({
          tenant_id: tenantId,
          channel_id: input.channel_id,
          template_id: input.template_id,
          name: input.name,
          status: 'draft',
          template_variables: input.template_variables || {},
          scheduled_at: input.scheduled_at || null,
          created_by_user_id: userId,
          total_recipients: input.contact_ids.length,
        })
        .select()
        .single();
      
      if (campaignError) {
        console.error('[useCreateMTCampaign] Failed to create campaign:', campaignError);
        throw campaignError;
      }
      
      console.log('[useCreateMTCampaign] Campaign created:', campaign.id);
      
      // NOTE: We no longer insert recipients here!
      // The campaign-start edge function handles:
      // 1. Upserting contacts to mt_contacts (resolves FK issues)
      // 2. Inserting campaign_recipients with valid contact IDs
      // This is done when the user clicks "Iniciar Campanha"
      
      return campaign as MTCampaign;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns', tenantId] });
      toast.success('Campanha criada como rascunho');
    },
    onError: (error) => {
      console.error('[useCreateMTCampaign] Error:', error);
      toast.error('Erro ao criar campanha', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Contact data for campaign start
export interface CampaignContactData {
  phone: string;
  name: string | null;
  email?: string | null;
}

/**
 * Parse error details from Supabase functions invoke response
 * The SDK may return error in `error` property or inside `data`
 */
function parseEdgeFunctionError(
  error: Error | null, 
  data: unknown
): { message: string; traceId?: string; code?: string } | null {
  // First check if there's a standardized error response in data
  if (data && typeof data === 'object') {
    const response = data as Record<string, unknown>;
    const traceId = response.traceId as string | undefined;
    
    // Standardized format: { ok: false, error: { code, message } }
    if (response.ok === false && response.error && typeof response.error === 'object') {
      const err = response.error as Record<string, unknown>;
      return {
        message: String(err.message || 'Erro no servidor'),
        code: String(err.code || 'UNKNOWN'),
        traceId,
      };
    }
    
    // Legacy format: { success: false, error: string }
    if (response.success === false && response.error) {
      const errorMsg = typeof response.error === 'string' 
        ? response.error 
        : (response.error as Record<string, unknown>).message || 'Erro no servidor';
      const details = response.details ? ` (${response.details})` : '';
      return {
        message: `${errorMsg}${details}`,
        traceId,
      };
    }
  }
  
  // Check the SDK error object
  if (error) {
    // Try to parse the error message as JSON (sometimes SDK wraps the response)
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error && typeof parsed.error === 'object') {
        return {
          message: String(parsed.error.message || error.message),
          code: String(parsed.error.code || 'UNKNOWN'),
          traceId: parsed.traceId,
        };
      }
      if (parsed.message) {
        return {
          message: parsed.message,
          traceId: parsed.traceId,
        };
      }
    } catch {
      // Not JSON, use the message directly
    }
    
    // Use the raw error message
    return {
      message: error.message || 'Erro de conexão',
    };
  }
  
  return null;
}

// Start campaign - uses new campaign-start edge function when contacts provided
// If no contacts provided, just updates status (for resuming campaigns with existing recipients)
export function useStartCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      campaignId, 
      contacts,
      speed = 'normal' 
    }: { 
      campaignId: string; 
      contacts?: CampaignContactData[];
      speed?: 'slow' | 'normal' | 'fast';
    }) => {
      console.log('[useStartCampaign] Starting campaign:', campaignId, 'with', contacts?.length || 0, 'contacts');
      
      // If contacts are provided, use the campaign-start edge function
      // This handles upsert to mt_contacts and creates campaign_recipients
      if (contacts && contacts.length > 0) {
        let responseData: unknown = null;
        let responseError: Error | null = null;
        
        try {
          const result = await supabase.functions.invoke('campaign-start', {
            body: { 
              campaign_id: campaignId, 
              contacts,
              speed 
            },
          });
          
          responseData = result.data;
          responseError = result.error;
          
          console.log('[useStartCampaign] Edge function response:', {
            hasData: !!responseData,
            hasError: !!responseError,
            data: responseData,
            error: responseError?.message,
          });
        } catch (fetchError) {
          // Network/CORS/Timeout error
          console.error('[useStartCampaign] Fetch exception:', fetchError);
          const errorMsg = fetchError instanceof Error 
            ? `Erro de conexão: ${fetchError.message}`
            : 'Erro de conexão com o servidor';
          throw new Error(errorMsg);
        }
        
        // Parse any error from the response
        const parsedError = parseEdgeFunctionError(responseError, responseData);
        
        if (parsedError) {
          const errorWithTrace = parsedError.traceId 
            ? `${parsedError.message} (Trace: ${parsedError.traceId})`
            : parsedError.message;
          console.error('[useStartCampaign] Parsed error:', parsedError);
          throw new Error(errorWithTrace);
        }
        
        // Check for success response
        const data = responseData as Record<string, unknown> | null;
        
        if (!data) {
          throw new Error('Resposta vazia do servidor');
        }
        
        // Check if enqueued is 0 (no recipients added)
        if (data.enqueued === 0) {
          const traceId = data.traceId as string | undefined;
          const errorMsg = 'Nenhum destinatário foi enfileirado. Verifique os contatos selecionados.';
          throw new Error(traceId ? `${errorMsg} (Trace: ${traceId})` : errorMsg);
        }
        
        return {
          campaign_id: campaignId,
          id: campaignId,
          enqueued: data.enqueued as number,
          traceId: data.traceId as string | undefined,
          ...data,
        };
      }
      
      // No contacts provided - just update status (for resuming or starting existing draft)
      // First check if there are existing recipients
      const { count: recipientCount } = await supabase
        .from('campaign_recipients')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);
      
      if (!recipientCount || recipientCount === 0) {
        throw new Error('Campanha não possui destinatários. Recrie a campanha com contatos.');
      }
      
      // Update status to running
      const { data, error } = await supabase
        .from('mt_campaigns')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Trigger first batch processing
      const { error: processError } = await supabase.functions.invoke('campaign-process-queue', {
        body: { campaign_id: campaignId, speed },
      });
      
      if (processError) {
        console.warn('[useStartCampaign] Failed to trigger initial processing:', processError);
      }
      
      return {
        campaign_id: campaignId,
        id: data.id,
        enqueued: recipientCount,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data.campaign_id || data.id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients', data.campaign_id || data.id] });
      
      const msg = data.enqueued 
        ? `Campanha iniciada com ${data.enqueued} destinatários`
        : 'Campanha iniciada';
      toast.success(msg);
    },
    onError: (error) => {
      console.error('[useStartCampaign] Error:', error);
      toast.error('Erro ao iniciar campanha', {
        description: error instanceof Error ? error.message : 'Erro desconhecido. Tente novamente.',
      });
    },
  });
}

// Pause campaign
export function usePauseCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string }) => {
      const { data, error } = await supabase
        .from('mt_campaigns')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data.id] });
      toast.success('Campanha pausada');
    },
    onError: (error) => {
      toast.error('Erro ao pausar campanha', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Resume campaign
export function useResumeCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId, speed = 'normal' }: { campaignId: string; speed?: string }) => {
      // Update status to running
      const { data, error } = await supabase
        .from('mt_campaigns')
        .update({
          status: 'running',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Trigger processing
      await supabase.functions.invoke('campaign-process-queue', {
        body: { campaign_id: campaignId, speed },
      });
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data.id] });
      toast.success('Campanha retomada');
    },
    onError: (error) => {
      toast.error('Erro ao retomar campanha', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Cancel campaign
export function useCancelCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string }) => {
      const { data, error } = await supabase
        .from('mt_campaigns')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data.id] });
      toast.success('Campanha cancelada');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar campanha', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Delete campaign
export function useDeleteMTCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId, tenantId }: { campaignId: string; tenantId: string }) => {
      // Delete recipients first
      await supabase
        .from('campaign_recipients')
        .delete()
        .eq('campaign_id', campaignId);
      
      // Delete campaign
      const { error } = await supabase
        .from('mt_campaigns')
        .delete()
        .eq('id', campaignId);
      
      if (error) throw error;
      
      return { campaignId, tenantId };
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns', tenantId] });
      toast.success('Campanha excluída');
    },
    onError: (error) => {
      toast.error('Erro ao excluir campanha', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Retry failed recipients
export function useRetryFailedRecipients() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId }: { campaignId: string }) => {
      // Reset failed recipients to queued
      const { data, error } = await supabase
        .from('campaign_recipients')
        .update({
          status: 'queued',
          last_error: null,
          attempts: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')
        .select();
      
      if (error) throw error;
      
      return { count: data?.length || 0 };
    },
    onSuccess: ({ count }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients'] });
      toast.success(`${count} destinatários colocados na fila novamente`);
    },
    onError: (error) => {
      toast.error('Erro ao reenviar', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });
}

// Helper to extract error details from response (now uses parseEdgeFunctionError for consistency)
function extractErrorDetails(data: unknown): { code: string; message: string; traceId?: string; details?: unknown } {
  const parsed = parseEdgeFunctionError(null, data);
  if (parsed) {
    return {
      code: parsed.code || 'UNKNOWN',
      message: parsed.message,
      traceId: parsed.traceId,
    };
  }
  
  // Fallback for edge cases
  if (!data || typeof data !== 'object') {
    return { code: 'UNKNOWN', message: 'Resposta inválida do servidor' };
  }
  
  const response = data as Record<string, unknown>;
  const traceId = response.traceId as string | undefined;
  
  // Errors array format
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    const firstError = response.errors[0] as Record<string, unknown>;
    return {
      code: String(firstError.code || 'BATCH_ERROR'),
      message: String(firstError.error || firstError.message || 'Erro no processamento'),
      traceId,
      details: response.errors,
    };
  }
  
  return { code: 'UNKNOWN', message: 'Erro no servidor', traceId };
}

// Process next batch (called from polling)
export function useProcessCampaignBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId, speed = 'normal' }: { campaignId: string; speed?: string }) => {
      let responseData: unknown = null;
      let responseError: Error | null = null;
      
      try {
        const result = await supabase.functions.invoke('campaign-process-queue', {
          body: { campaign_id: campaignId, speed },
        });
        responseData = result.data;
        responseError = result.error;
      } catch (fetchError) {
        console.error('[useProcessCampaignBatch] Fetch exception:', fetchError);
        throw new Error(fetchError instanceof Error ? fetchError.message : 'Erro de conexão');
      }
      
      // Parse error from response
      const parsedError = parseEdgeFunctionError(responseError, responseData);
      
      if (parsedError) {
        // Don't throw for "not running" - it's expected when campaign finishes
        if (parsedError.code === 'CAMPAIGN_NOT_RUNNING') {
          console.log('[useProcessCampaignBatch] Campaign finished, not an error');
          return { 
            ...(responseData as Record<string, unknown>), 
            campaign_id: campaignId, 
            finished: true 
          };
        }
        
        const errorWithTrace = parsedError.traceId 
          ? `${parsedError.message} (Trace: ${parsedError.traceId})`
          : parsedError.message;
        throw new Error(errorWithTrace);
      }
      
      return { ...(responseData as Record<string, unknown>), campaign_id: campaignId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data?.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients', data?.campaign_id] });
    },
    onError: (error) => {
      // Only show toast for unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar campanha';
      if (!errorMessage.includes('não está em execução') && !errorMessage.includes('CAMPAIGN_NOT_RUNNING')) {
        console.error('[useProcessCampaignBatch] Error:', errorMessage);
        toast.error('Erro ao processar lote', {
          description: errorMessage,
        });
      }
    },
  });
}
