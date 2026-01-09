import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MTCampaignForm } from "@/components/campaigns/MTCampaignForm";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";

export default function NewCampaign() {
  const user = useProtectedUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Nova Campanha</h2>
          <p className="text-muted-foreground mt-2">
            Crie uma campanha de mensagens usando templates aprovados
          </p>
        </div>
        
        <MTCampaignForm />
      </div>
    </DashboardLayout>
  );
}