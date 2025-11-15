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
      gradient: "from-[hsl(228,100%,58%)] to-[hsl(228,100%,48%)]",
    },
    {
      title: "Campanhas Criadas",
      value: metrics?.totalCampaigns || 0,
      icon: Send,
      gradient: "from-[hsl(270,80%,55%)] to-[hsl(270,80%,45%)]",
    },
    {
      title: "Mensagens Enviadas",
      value: metrics?.totalMessages || 0,
      icon: CheckCircle2,
      gradient: "from-[hsl(142,76%,45%)] to-[hsl(142,76%,36%)]",
    },
    {
      title: "Taxa de Visualização",
      value: `${metrics?.readRate || 0}%`,
      icon: Eye,
      gradient: "from-[hsl(24,96%,58%)] to-[hsl(24,96%,48%)]",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card 
          key={card.title}
          className="relative overflow-hidden border-0 bg-gradient-to-br shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-105"
          style={{
            backgroundImage: `linear-gradient(135deg, ${card.gradient.replace('from-', '').replace('to-', ', ')})`,
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/90">
              {card.title}
            </CardTitle>
            <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
              <card.icon className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
