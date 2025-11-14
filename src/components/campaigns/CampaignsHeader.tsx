import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CampaignsHeader() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Campanhas</h2>
        <p className="text-muted-foreground mt-2">
          Gerencie e acompanhe suas campanhas de mensagens
        </p>
      </div>
      <Button onClick={() => navigate("/dashboard/campaigns/new")} className="gap-2">
        <PlusCircle className="h-4 w-4" />
        Nova Campanha
      </Button>
    </div>
  );
}
