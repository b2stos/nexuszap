import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCircle2, Eye, Clock } from "lucide-react";

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

      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const { data: last24h } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .gte("created_at", last24Hours.toISOString())
        .in("status", ["sent", "delivered", "read"]);

      const totalContacts = contacts?.length || 0;
      const totalCampaigns = campaigns?.length || 0;
      const totalMessages = sent?.length || 0;
      const deliveryRate = totalMessages > 0 ? ((delivered?.length || 0) / totalMessages) * 100 : 0;
      const readRate = totalMessages > 0 ? ((read?.length || 0) / totalMessages) * 100 : 0;
      const messagesLast24h = last24h?.length || 0;

      return {
        totalContacts,
        totalCampaigns,
        totalMessages,
        deliveryRate: deliveryRate.toFixed(1),
        readRate: readRate.toFixed(1),
        messagesLast24h,
      };
    },
  });

  const cards = [
    {
      title: "Total de Mensagens Enviadas",
      value: metrics?.totalMessages || 0,
      icon: Send,
      description: "Total de mensagens enviadas"
    },
    {
      title: "Taxa de Entrega",
      value: `${metrics?.deliveryRate || 0}%`,
      icon: CheckCircle2,
      description: "Mensagens entregues com sucesso"
    },
    {
      title: "Mensagens Lidas",
      value: metrics?.readRate || 0,
      icon: Eye,
      description: "Taxa de visualização"
    },
    {
      title: "Últimas 24h",
      value: metrics?.messagesLast24h || 0,
      icon: Clock,
      description: "Mensagens enviadas hoje"
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card 
          key={card.title}
          className="relative overflow-hidden border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] group"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {card.title}
            </CardTitle>
            <div className="rounded-lg bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors">
              <card.icon className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-4xl font-bold text-foreground tracking-tight">{card.value}</div>
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-primary/20 via-primary to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
      ))}
    </div>
  );
}
