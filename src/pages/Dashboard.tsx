import { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { WebhookMonitorMT } from "@/components/dashboard/WebhookMonitorMT";
import { PaymentAlertBanner } from "@/components/dashboard/PaymentAlertBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { OnboardingCompletionModal } from "@/components/onboarding/OnboardingCompletionModal";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useCurrentTenant } from "@/hooks/useInbox";

export default function Dashboard() {
  const user = useProtectedUser();
  const { data: tenant } = useCurrentTenant();
  const { showWelcome, isComplete, progress, completeStep } = useOnboarding();
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [dismissedChecklist, setDismissedChecklist] = useState(false);

  // Handle welcome completion
  const handleWelcomeComplete = () => {
    completeStep('welcome');
  };

  // Show completion modal when all steps are done
  useEffect(() => {
    if (progress === 100 && !isComplete) {
      setShowCompletionModal(true);
    }
  }, [progress, isComplete]);

  return (
    <DashboardLayout user={user}>
      {/* Welcome Modal for first login */}
      <WelcomeModal open={!!showWelcome} onComplete={handleWelcomeComplete} />
      
      {/* Completion Modal */}
      <OnboardingCompletionModal 
        open={showCompletionModal} 
        onClose={() => setShowCompletionModal(false)} 
      />

      <div className="space-y-8 animate-fade-in">
        {/* Global Payment Alert Banner - filtered by tenant */}
        <PaymentAlertBanner tenantId={tenant?.tenantId} />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Visão geral das suas campanhas e métricas
            </p>
          </div>
        </div>

        {/* 1. Onboarding Checklist - Comece por aqui */}
        {!isComplete && !dismissedChecklist && (
          <OnboardingChecklist onDismiss={() => setDismissedChecklist(true)} />
        )}
        
        {/* 2. Visão Geral + Webhooks em Tempo Real */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks (Tempo Real)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <MetricsCards />
          </TabsContent>
          
          <TabsContent value="webhooks">
            <WebhookMonitorMT />
          </TabsContent>
        </Tabs>

        {/* 3. Campanhas Recentes */}
        <RecentCampaigns />
      </div>
    </DashboardLayout>
  );
}
