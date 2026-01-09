/**
 * useOnboarding Hook
 * 
 * Gerencia o estado do onboarding do tenant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OnboardingState {
  id: string;
  tenant_id: string;
  welcome_completed_at: string | null;
  channel_connected_at: string | null;
  template_created_at: string | null;
  first_message_sent_at: string | null;
  inbox_opened_at: string | null;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
}

export type OnboardingStep = 
  | 'welcome'
  | 'channel_connected'
  | 'template_created'
  | 'first_message_sent'
  | 'inbox_opened';

const STEP_COLUMNS: Record<OnboardingStep, string> = {
  welcome: 'welcome_completed_at',
  channel_connected: 'channel_connected_at',
  template_created: 'template_created_at',
  first_message_sent: 'first_message_sent_at',
  inbox_opened: 'inbox_opened_at',
};

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

// Fetch onboarding state
async function fetchOnboarding(): Promise<OnboardingState | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from('tenant_onboarding')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();
  
  if (error) {
    console.error('Error fetching onboarding:', error);
    return null;
  }
  
  return data as OnboardingState;
}

// Complete a step
async function completeStep(step: OnboardingStep): Promise<void> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('No tenant found');

  const column = STEP_COLUMNS[step];
  
  const { error } = await supabase
    .from('tenant_onboarding')
    .update({ [column]: new Date().toISOString() })
    .eq('tenant_id', tenantId);
  
  if (error) throw error;
}

// Mark onboarding as complete
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

export function useOnboarding() {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ['onboarding'],
    queryFn: fetchOnboarding,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const completeStepMutation = useMutation({
    mutationFn: completeStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
    onError: (error) => {
      console.error('Error completing step:', error);
    },
  });
  
  const completeOnboardingMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      toast({
        title: '🎉 Tudo pronto!',
        description: 'Você já pode usar o WhatsApp Oficial.',
      });
    },
  });
  
  // Calculate progress
  const state = query.data;
  const steps = [
    { id: 'welcome' as const, completed: !!state?.welcome_completed_at },
    { id: 'channel_connected' as const, completed: !!state?.channel_connected_at },
    { id: 'template_created' as const, completed: !!state?.template_created_at },
    { id: 'first_message_sent' as const, completed: !!state?.first_message_sent_at },
    { id: 'inbox_opened' as const, completed: !!state?.inbox_opened_at },
  ];
  
  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isComplete = state?.onboarding_completed || progress === 100;
  
  // Check if should show welcome
  const showWelcome = state && !state.welcome_completed_at;
  
  return {
    state,
    isLoading: query.isLoading,
    steps,
    progress,
    isComplete,
    showWelcome,
    completeStep: completeStepMutation.mutate,
    completeOnboarding: completeOnboardingMutation.mutate,
    refetch: query.refetch,
  };
}

// Hook to mark a step as complete when component mounts
export function useMarkOnboardingStep(step: OnboardingStep) {
  const { state, completeStep } = useOnboarding();
  
  // Check if step needs to be marked
  const needsMarking = state && !state[STEP_COLUMNS[step] as keyof OnboardingState];
  
  return {
    markComplete: () => {
      if (needsMarking) {
        completeStep(step);
      }
    },
    isMarked: !needsMarking,
  };
}
