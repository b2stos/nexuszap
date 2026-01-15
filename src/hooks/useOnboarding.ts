/**
 * useOnboarding Hook
 * 
 * Calcula o status do onboarding em TEMPO REAL baseado nos dados do banco.
 * NÃO usa timestamps salvos - sempre verifica o estado atual.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OnboardingStatus {
  whatsappConnected: boolean;
  hasApprovedTemplate: boolean;
  hasSentMessage: boolean;
  hasInboxConversation: boolean;
}

export type OnboardingStep = 
  | 'welcome'
  | 'channel_connected'
  | 'template_created'
  | 'first_message_sent'
  | 'inbox_opened';

// Get current tenant for user
async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();
  
  return data?.tenant_id || null;
}

// Fetch onboarding status in REAL-TIME from actual data
async function fetchOnboardingStatus(): Promise<OnboardingStatus | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  // Run all queries in parallel for performance
  const [
    channelsResult,
    templatesResult,
    messagesResult,
    conversationsResult
  ] = await Promise.all([
    // 1. Check if there's at least 1 connected channel
    supabase
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'connected'),
    
    // 2. Check if there's at least 1 approved template (from Meta)
    supabase
      .from('mt_templates')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .eq('source', 'meta'),
    
    // 3. Check if there's at least 1 successfully sent outbound message
    supabase
      .from('mt_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('direction', 'outbound')
      .in('status', ['sent', 'delivered', 'read']),
    
    // 4. Check if there's at least 1 conversation (inbox activity)
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
  ]);

  return {
    whatsappConnected: (channelsResult.count || 0) > 0,
    hasApprovedTemplate: (templatesResult.count || 0) > 0,
    hasSentMessage: (messagesResult.count || 0) > 0,
    hasInboxConversation: (conversationsResult.count || 0) > 0,
  };
}

// Check if welcome was completed (this one we keep from db as it's a one-time action)
async function fetchWelcomeCompleted(): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return true; // Default to completed if no tenant

  const { data } = await supabase
    .from('tenant_onboarding')
    .select('welcome_completed_at, onboarding_completed')
    .eq('tenant_id', tenantId)
    .single();
  
  return !!data?.welcome_completed_at;
}

// Check if onboarding was manually marked complete
async function fetchOnboardingManuallyCompleted(): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;

  const { data } = await supabase
    .from('tenant_onboarding')
    .select('onboarding_completed')
    .eq('tenant_id', tenantId)
    .single();
  
  return !!data?.onboarding_completed;
}

// Complete welcome step
async function completeWelcome(): Promise<void> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('No tenant found');

  const { error } = await supabase
    .from('tenant_onboarding')
    .update({ welcome_completed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);
  
  if (error) throw error;
}

// Mark onboarding as complete (dismiss the checklist)
async function completeOnboarding(): Promise<void> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('No tenant found');

  const { error } = await supabase
    .from('tenant_onboarding')
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
  
  if (error) throw error;
}

// Reset onboarding (make checklist visible again)
async function resetOnboarding(): Promise<void> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('No tenant found');

  const { error } = await supabase
    .from('tenant_onboarding')
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
    })
    .eq('tenant_id', tenantId);
  
  if (error) throw error;
}

export function useOnboarding() {
  const queryClient = useQueryClient();
  
  // Fetch real-time status from actual data
  const statusQuery = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: fetchOnboardingStatus,
    staleTime: 1000 * 30, // 30 seconds - refresh often for real-time feel
    refetchOnWindowFocus: true,
  });

  // Fetch welcome completion status
  const welcomeQuery = useQuery({
    queryKey: ['onboarding-welcome'],
    queryFn: fetchWelcomeCompleted,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch manual completion status
  const manualCompleteQuery = useQuery({
    queryKey: ['onboarding-manual-complete'],
    queryFn: fetchOnboardingManuallyCompleted,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const completeWelcomeMutation = useMutation({
    mutationFn: completeWelcome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-welcome'] });
    },
  });
  
  const completeOnboardingMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-manual-complete'] });
      toast({
        title: '🎉 Tudo pronto!',
        description: 'Você já pode usar o WhatsApp Oficial.',
      });
    },
  });

  const resetOnboardingMutation = useMutation({
    mutationFn: resetOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-manual-complete'] });
    },
  });
  
  // Calculate steps from REAL data
  const status = statusQuery.data;
  const welcomeCompleted = welcomeQuery.data ?? true;
  const manuallyCompleted = manualCompleteQuery.data ?? false;

  const steps = [
    { id: 'welcome' as const, completed: welcomeCompleted },
    { id: 'channel_connected' as const, completed: status?.whatsappConnected ?? false },
    { id: 'template_created' as const, completed: status?.hasApprovedTemplate ?? false },
    { id: 'first_message_sent' as const, completed: status?.hasSentMessage ?? false },
    { id: 'inbox_opened' as const, completed: status?.hasInboxConversation ?? false },
  ];
  
  // Calculate progress (excluding welcome step for the percentage)
  const mainSteps = steps.filter(s => s.id !== 'welcome');
  const completedCount = mainSteps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / mainSteps.length) * 100);
  
  // Onboarding is complete if manually marked OR all steps are done
  const isComplete = manuallyCompleted || progress === 100;
  
  // Show welcome if not completed
  const showWelcome = !welcomeCompleted;
  
  return {
    status,
    isLoading: statusQuery.isLoading,
    steps,
    progress,
    isComplete,
    showWelcome,
    completeStep: (step: OnboardingStep) => {
      if (step === 'welcome') {
        completeWelcomeMutation.mutate();
      }
      // Other steps are auto-detected from real data, no manual marking needed
    },
    completeOnboarding: completeOnboardingMutation.mutate,
    resetOnboarding: resetOnboardingMutation.mutate,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-welcome'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-manual-complete'] });
    },
  };
}

// Utility to invalidate onboarding status from other parts of the app
export function useInvalidateOnboarding() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
  };
}

// Hook to mark a step as complete when component mounts (legacy support)
export function useMarkOnboardingStep(step: OnboardingStep) {
  const { steps, completeStep } = useOnboarding();
  
  const currentStep = steps.find(s => s.id === step);
  const needsMarking = step === 'welcome' && !currentStep?.completed;
  
  return {
    markComplete: () => {
      if (needsMarking) {
        completeStep(step);
      }
    },
    isMarked: !needsMarking,
  };
}
