/**
 * useChannels Hook
 * 
 * Hook para gerenciar canais WhatsApp (BSP)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ChannelProviderConfig {
  api_key?: string; // Token de autenticação da API (NotificaMe BSP)
  subscription_id?: string; // UUID do canal no NotificaMe (from)
  waba_id?: string; // WhatsApp Business Account ID (Meta)
  access_token?: string; // Access Token da Meta Graph API (opcional)
  base_url?: string;
  api_key_header?: string;
  api_key_prefix?: string;
  webhook_secret?: string;
  timeout_ms?: number;
  endpoints?: Record<string, string>;
  custom_headers?: Record<string, string>;
}

export interface Channel {
  id: string;
  tenant_id: string;
  provider_id: string;
  name: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  provider_config: ChannelProviderConfig | Record<string, unknown> | null;
  provider_phone_id: string | null;
  verified_name: string | null;
  quality_rating: string | null;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  provider?: {
    id: string;
    name: string;
    display_name: string;
    type: string;
  };
}

export interface CreateChannelInput {
  name: string;
  phone_number?: string;
  provider_config: {
    subscription_id: string;
    // api_key is now server-side only (ENV: NOTIFICAME_X_API_TOKEN)
    api_key?: string;
    base_url?: string;
    webhook_secret?: string;
  };
}

export interface UpdateChannelInput {
  name?: string;
  phone_number?: string;
  provider_config?: Partial<ChannelProviderConfig>;
  status?: Channel['status'];
}

// Get current user's tenant
export function useCurrentTenantForChannels() {
  return useQuery({
    queryKey: ['current-tenant-channels'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tenant_users')
        .select('tenant_id, role, tenant:tenants(id, name, slug)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('No tenant found');

      return {
        tenantId: data.tenant_id,
        role: data.role,
        tenant: data.tenant,
      };
    },
  });
}

// Get NotificaMe provider
export function useNotificaMeProvider() {
  return useQuery({
    queryKey: ['notificame-provider'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('name', 'notificame')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

// List channels for tenant
export function useChannels(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['channels', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          provider:providers(id, name, display_name, type)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Channel[];
    },
    enabled: !!tenantId,
  });
}

// Get single channel
export function useChannel(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      if (!channelId) return null;

      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          provider:providers(id, name, display_name, type)
        `)
        .eq('id', channelId)
        .single();

      if (error) throw error;
      return data as unknown as Channel;
    },
    enabled: !!channelId,
  });
}

// Create channel
export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      providerId,
      input,
    }: {
      tenantId: string;
      providerId: string;
      input: CreateChannelInput;
    }) => {
      const insertData = {
        tenant_id: tenantId,
        provider_id: providerId,
        name: input.name,
        phone_number: input.phone_number || null,
        status: 'pending' as const,
        provider_config: JSON.parse(JSON.stringify(input.provider_config)),
      };
      
      const { data, error } = await supabase
        .from('channels')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channels', variables.tenantId] });
      // Invalidate onboarding status to recalculate in real-time
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      toast({
        title: 'Canal criado',
        description: 'O canal foi criado com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error creating channel:', error);
      toast({
        title: 'Erro ao criar canal',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Update channel
export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      input,
    }: {
      channelId: string;
      input: UpdateChannelInput;
    }) => {
      const updateData: Record<string, unknown> = {};
      
      if (input.name) updateData.name = input.name;
      if (input.phone_number !== undefined) updateData.phone_number = input.phone_number;
      if (input.status) updateData.status = input.status;
      if (input.provider_config) {
        // Merge with existing config
        const { data: existing } = await supabase
          .from('channels')
          .select('provider_config')
          .eq('id', channelId)
          .single();
        
        updateData.provider_config = {
          ...(existing?.provider_config as Record<string, unknown> || {}),
          ...input.provider_config,
        };
      }

      const { data, error } = await supabase
        .from('channels')
        .update(updateData)
        .eq('id', channelId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channel', data.id] });
      toast({
        title: 'Canal atualizado',
        description: 'As configurações foram salvas.',
      });
    },
    onError: (error) => {
      console.error('Error updating channel:', error);
      toast({
        title: 'Erro ao atualizar canal',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Delete channel
export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      // Invalidate onboarding status to recalculate in real-time
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      toast({
        title: 'Canal removido',
        description: 'O canal foi removido com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error deleting channel:', error);
      toast({
        title: 'Erro ao remover canal',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

// Test channel connection
export function useTestChannel() {
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await supabase.functions.invoke('test-channel-connection', {
        body: {
          channel_id: channelId,
        },
      });

      if (error) throw error;
      
      // Check for API-level errors
      if (data && !data.success) {
        throw new Error(data.error?.detail || data.message || 'Falha na conexão');
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Conexão OK!',
        description: data?.message || 'As credenciais estão funcionando corretamente.',
      });
    },
    onError: (error) => {
      console.error('Error testing channel:', error);
      toast({
        title: 'Erro na conexão',
        description: error instanceof Error ? error.message : 'Não foi possível conectar ao BSP',
        variant: 'destructive',
      });
    },
  });
}

// Validate NotificaMe token and discover channels
export interface DiscoveredChannel {
  id: string;
  name?: string;
  phone?: string;
  type?: string;
}

export interface ValidateTokenResult {
  success: boolean;
  valid: boolean;
  message: string;
  channels: DiscoveredChannel[];
  error?: { detail: string; code?: string };
}

export function useValidateToken() {
  return useMutation({
    mutationFn: async ({ token, channelId }: { token: string; channelId?: string }): Promise<ValidateTokenResult> => {
      const { data, error } = await supabase.functions.invoke('validate-notificame-token', {
        body: {
          token,
          channel_id: channelId,
        },
      });

      if (error) throw error;
      return data as ValidateTokenResult;
    },
    onSuccess: (data) => {
      if (data.valid) {
        const channelCount = data.channels?.length || 0;
        toast({
          title: 'Token válido!',
          description: channelCount > 0 
            ? `Encontrados ${channelCount} canal(is) automaticamente.`
            : data.message,
        });
      } else {
        toast({
          title: 'Token inválido',
          description: data.message || data.error?.detail || 'Verifique o token.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      console.error('Error validating token:', error);
      toast({
        title: 'Erro ao validar token',
        description: error instanceof Error ? error.message : 'Não foi possível validar o token',
        variant: 'destructive',
      });
    },
  });
}

// Get webhook URL for channel
export function getWebhookUrl(channelId: string): string {
  const projectId = 'xaypooqwcrhytkfqyzha';
  return `https://${projectId}.supabase.co/functions/v1/webhook-notificame?channel_id=${channelId}`;
}
