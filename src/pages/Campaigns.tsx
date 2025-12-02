import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CampaignsHeader } from "@/components/campaigns/CampaignsHeader";
import { CampaignsGrid } from "@/components/campaigns/CampaignsGrid";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";

export default function Campaigns() {
  const user = useProtectedUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <CampaignsHeader />
        <CampaignsGrid />
      </div>
    </DashboardLayout>
  );
}
