import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sending: "Enviando",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sending: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-orange-500",
};

export function RecentCampaigns() {
  const navigate = useNavigate();

  const { data: campaigns } = useQuery({
    queryKey: ["recent-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campanhas Recentes</CardTitle>
            <CardDescription>Últimas campanhas criadas</CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard/campaigns")}>
            Ver todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaigns?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma campanha criada ainda
            </p>
          )}
          {campaigns?.map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{campaign.name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
                  {statusLabels[campaign.status as keyof typeof statusLabels]}
                </Badge>
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
