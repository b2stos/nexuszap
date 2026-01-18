import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCircle2, Eye, Clock } from "lucide-react";
import { useCurrentTenant } from "@/hooks/useInbox";

export function MetricsCards() {
  const { data: tenant } = useCurrentTenant();
  
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics-mt", tenant?.tenantId],
    enabled: !!tenant?.tenantId,
    refetchInterval: 10000, // Polling a cada 10s para métricas em tempo real
    queryFn: async () => {
      const tenantId = tenant!.tenantId;
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      
      // 1. Total de contatos (mt_contacts)
      const { count: totalContacts } = await supabase
        .from("mt_contacts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      // 2. Total de campanhas (mt_campaigns)
      const { count: totalCampaigns } = await supabase
        .from("mt_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      // 3. Métricas de mensagens outbound (mt_messages) - fonte da verdade
      const { data: messageStats } = await supabase
        .from("mt_messages")
        .select("status, created_at")
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound");
      
      // Contar por status
      const sentMessages = messageStats?.filter(m => 
        ['sent', 'delivered', 'read'].includes(m.status)
      ) || [];
      
      const deliveredMessages = messageStats?.filter(m => 
        ['delivered', 'read'].includes(m.status)
      ) || [];
      
      const readMessages = messageStats?.filter(m => 
        m.status === 'read'
      ) || [];
      
      // Mensagens nas últimas 24h
      const last24hMessages = sentMessages.filter(m => 
        new Date(m.created_at) >= last24Hours
      );

      const totalSent = sentMessages.length;
      const totalDelivered = deliveredMessages.length;
      const totalRead = readMessages.length;
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

      return {
        totalContacts: totalContacts || 0,
        totalCampaigns: totalCampaigns || 0,
        totalMessages: totalSent,
        deliveryRate: deliveryRate.toFixed(1),
        readRate: readRate.toFixed(1),
        messagesLast24h: last24hMessages.length,
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
      value: `${metrics?.readRate || 0}%`,
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

  if (!tenant?.tenantId) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="relative overflow-hidden border border-border/50 bg-card">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

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
