import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle2, Eye, AlertCircle } from "lucide-react";

const statusLabels = {
  draft: "Rascunho",
  sending: "Enviando",
  completed: "Concluída",
  failed: "Falhou",
};

const statusColors = {
  draft: "bg-gray-500",
  sending: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
};

export function CampaignsGrid() {
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          messages(id, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {campaigns?.length === 0 && (
        <div className="col-span-full text-center py-12 text-muted-foreground">
          Nenhuma campanha criada ainda
        </div>
      )}
      {campaigns?.map((campaign) => {
        const messages = campaign.messages || [];
        const totalMessages = messages.length;
        const sentMessages = messages.filter((m: any) => 
          ["sent", "delivered", "read"].includes(m.status)
        ).length;
        const deliveredMessages = messages.filter((m: any) => 
          ["delivered", "read"].includes(m.status)
        ).length;
        const readMessages = messages.filter((m: any) => 
          m.status === "read"
        ).length;

        return (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CardDescription>
                    {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                  </CardDescription>
                </div>
                <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
                  {statusLabels[campaign.status as keyof typeof statusLabels]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {campaign.message_content}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Enviadas</p>
                      <p className="text-sm font-medium">{sentMessages}/{totalMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Entregues</p>
                      <p className="text-sm font-medium">{deliveredMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Lidas</p>
                      <p className="text-sm font-medium">{readMessages}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Taxa</p>
                      <p className="text-sm font-medium">
                        {totalMessages > 0 ? ((readMessages / totalMessages) * 100).toFixed(0) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
