import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  Clock,
  Send,
  Loader2
} from "lucide-react";

interface CampaignProgressProps {
  campaignId: string;
  onComplete?: () => void;
}

interface MessageStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
}

export function CampaignProgress({ campaignId, onComplete }: CampaignProgressProps) {
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0,
  });
  const [campaignStatus, setCampaignStatus] = useState<string>("sending");
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      // Get message counts by status
      const { data: messages, error } = await supabase
        .from("messages")
        .select("status")
        .eq("campaign_id", campaignId);

      if (error) throw error;

      const counts = {
        total: messages?.length || 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        pending: 0,
      };

      messages?.forEach((msg) => {
        switch (msg.status) {
          case "sent":
            counts.sent++;
            break;
          case "delivered":
            counts.delivered++;
            break;
          case "read":
            counts.read++;
            break;
          case "failed":
            counts.failed++;
            break;
          case "pending":
            counts.pending++;
            break;
        }
      });

      setStats(counts);

      // Get campaign status
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        setCampaignStatus(campaign.status);
        
        if (campaign.status === "completed" || campaign.status === "failed") {
          onComplete?.();
        }
      }
    } catch (error) {
      console.error("Error loading campaign stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Subscribe to realtime updates on messages table
    const messagesChannel = supabase
      .channel(`campaign-messages-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          // Reload stats when any message changes
          loadStats();
        }
      )
      .subscribe();

    // Subscribe to campaign status changes
    const campaignChannel = supabase
      .channel(`campaign-status-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.new) {
            setCampaignStatus((payload.new as any).status);
            if ((payload.new as any).status === "completed" || (payload.new as any).status === "failed") {
              onComplete?.();
            }
          }
        }
      )
      .subscribe();

    // Poll every 3 seconds as backup
    const interval = setInterval(loadStats, 3000);

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(campaignChannel);
      clearInterval(interval);
    };
  }, [campaignId]);

  const processedCount = stats.sent + stats.delivered + stats.read + stats.failed;
  const successCount = stats.sent + stats.delivered + stats.read;
  const progressPercent = stats.total > 0 ? (processedCount / stats.total) * 100 : 0;

  const getStatusBadge = () => {
    switch (campaignStatus) {
      case "sending":
        return (
          <Badge className="bg-blue-500 animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Enviando
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Concluída
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return <Badge variant="secondary">{campaignStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Progresso do Envio
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          {processedCount} de {stats.total} mensagens processadas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-3" />
          <p className="text-sm text-muted-foreground text-center">
            {progressPercent.toFixed(0)}% concluído
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          
          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Send className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-blue-500">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </div>
          
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-500">{stats.delivered + stats.read}</p>
            <p className="text-xs text-muted-foreground">Entregues</p>
          </div>
          
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xl font-bold text-destructive">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Falharam</p>
          </div>
        </div>

        {/* Status message */}
        {campaignStatus === "sending" && (
          <p className="text-sm text-muted-foreground text-center">
            ⏳ Enviando mensagens em segundo plano... Você pode sair desta página.
          </p>
        )}
        
        {campaignStatus === "completed" && (
          <p className="text-sm text-green-600 text-center">
            ✅ Campanha concluída! {successCount} mensagens enviadas com sucesso.
          </p>
        )}
        
        {campaignStatus === "failed" && stats.failed === stats.total && (
          <p className="text-sm text-destructive text-center">
            ❌ Falha no envio. Verifique suas credenciais UAZAPI.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
