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
        const { data, error } = await supabase.functions.invoke('campaign-start', {
          body: { 
            campaign_id: campaignId, 
            contacts,
            speed 
          },
        });
        
        console.log('[useStartCampaign] Edge function response:', data, error);
        
        if (error) {
          console.error('[useStartCampaign] Edge function error:', error);
          throw new Error(error.message || 'Erro ao iniciar campanha');
        }
        
        // Handle standardized error response
        if (data && typeof data === 'object') {
          const response = data as Record<string, unknown>;
          const traceId = response.traceId as string | undefined;
          
          if (response.ok === false && response.error) {
            const err = response.error as Record<string, unknown>;
            const errorMsg = String(err.message || 'Erro desconhecido');
            const errorWithTrace = traceId ? `${errorMsg} (Trace: ${traceId})` : errorMsg;
            console.error('[useStartCampaign] API error:', err);
            throw new Error(errorWithTrace);
          }
          
          // Legacy format
          if (!response.success && response.error) {
            const errorMsg = String(response.error);
            const details = response.details ? ` (${response.details})` : '';
            const errorWithTrace = traceId ? `${errorMsg}${details} (Trace: ${traceId})` : `${errorMsg}${details}`;
            console.error('[useStartCampaign] Start failed:', errorMsg, details);
            throw new Error(errorWithTrace);
          }
        }
        
        if (!data?.success) {
          const errorMsg = data?.error || 'Falha ao enfileirar destinatários';
          const details = data?.details ? ` (${data.details})` : '';
          console.error('[useStartCampaign] Start failed:', errorMsg, details);
          throw new Error(`${errorMsg}${details}`);
        }
        
        if (data.enqueued === 0) {
          throw new Error('Nenhum destinatário foi enfileirado. Verifique os contatos selecionados.');
        }
        
        return {
          campaign_id: campaignId,
          id: campaignId,
          enqueued: data.enqueued,
          traceId: data.traceId,
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
        description: error instanceof Error ? error.message : 'Tente novamente',
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

// Helper to extract error details from response
function extractErrorDetails(data: unknown): { code: string; message: string; traceId?: string; details?: unknown } {
  if (!data || typeof data !== 'object') {
    return { code: 'UNKNOWN', message: 'Erro desconhecido' };
  }
  
  const response = data as Record<string, unknown>;
  const traceId = response.traceId as string | undefined;
  
  // Standardized format: { ok: false, traceId, error: { code, message, details } }
  if (response.ok === false && response.error && typeof response.error === 'object') {
    const err = response.error as Record<string, unknown>;
    return {
      code: String(err.code || 'UNKNOWN'),
      message: String(err.message || 'Erro no servidor'),
      traceId,
      details: err.details,
    };
  }
  
  // Legacy format: { error: string }
  if (typeof response.error === 'string') {
    return {
      code: 'LEGACY_ERROR',
      message: response.error,
      traceId,
      details: response.details || response.status,
    };
  }
  
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
  
  return { code: 'UNKNOWN', message: 'Erro desconhecido', traceId };
}

// Process next batch (called from polling)
export function useProcessCampaignBatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ campaignId, speed = 'normal' }: { campaignId: string; speed?: string }) => {
      const { data, error } = await supabase.functions.invoke('campaign-process-queue', {
        body: { campaign_id: campaignId, speed },
      });
      
      // Handle Supabase invoke error
      if (error) {
        console.error('[useProcessCampaignBatch] Invoke error:', error);
        throw new Error(error.message || 'Erro ao processar campanha');
      }
      
      // Check for standardized error response
      if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === false) {
        const errorDetails = extractErrorDetails(data);
        console.error('[useProcessCampaignBatch] API error:', errorDetails);
        
        // Don't throw for "not running" - it's expected when campaign finishes
        if (errorDetails.code === 'CAMPAIGN_NOT_RUNNING') {
          console.log('[useProcessCampaignBatch] Campaign finished, not an error');
          return { ...data, campaign_id: campaignId, finished: true };
        }
        
        const errorWithTrace = errorDetails.traceId 
          ? `${errorDetails.message} (Trace: ${errorDetails.traceId})`
          : errorDetails.message;
        throw new Error(errorWithTrace);
      }
      
      return { ...data, campaign_id: campaignId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mt-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign', data?.campaign_id] });
      queryClient.invalidateQueries({ queryKey: ['campaign-recipients', data?.campaign_id] });
    },
    onError: (error) => {
      // Only show toast for unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (!errorMessage.includes('não está em execução')) {
        console.error('[useProcessCampaignBatch] Error:', errorMessage);
        toast.error('Erro ao processar lote', {
          description: errorMessage,
        });
      }
    },
  });
}
