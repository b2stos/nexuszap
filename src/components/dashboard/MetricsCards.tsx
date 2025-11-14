import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Send, CheckCircle2, Eye } from "lucide-react";

export function MetricsCards() {
  const { data: metrics } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id", { count: "exact" });

      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id", { count: "exact" });

      const { data: messages } = await supabase
        .from("messages")
        .select("status", { count: "exact" });

      const { data: sent } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("status", ["sent", "delivered", "read"]);

      const { data: delivered } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .in("status", ["delivered", "read"]);

      const { data: read } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .eq("status", "read");

      const totalContacts = contacts?.length || 0;
      const totalCampaigns = campaigns?.length || 0;
      const totalMessages = sent?.length || 0;
      const deliveryRate = totalMessages > 0 ? ((delivered?.length || 0) / totalMessages) * 100 : 0;
      const readRate = totalMessages > 0 ? ((read?.length || 0) / totalMessages) * 100 : 0;

      return {
        totalContacts,
        totalCampaigns,
        totalMessages,
        deliveryRate: deliveryRate.toFixed(1),
        readRate: readRate.toFixed(1),
      };
    },
  });

  const cards = [
    {
      title: "Total de Contatos",
      value: metrics?.totalContacts || 0,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Campanhas Criadas",
      value: metrics?.totalCampaigns || 0,
      icon: Send,
      color: "text-purple-500",
    },
    {
      title: "Mensagens Enviadas",
      value: metrics?.totalMessages || 0,
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      title: "Taxa de Visualização",
      value: `${metrics?.readRate || 0}%`,
      icon: Eye,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
