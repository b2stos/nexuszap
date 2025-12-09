import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { 
  Webhook, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Copy, 
  AlertTriangle,
  Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface WebhookEvent {
  id: string;
  event_type: string;
  status: string | null;
  phone: string | null;
  processed: boolean | null;
  created_at: string;
}

export function WebhookDiagnostics() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    last24h: 0,
    processed: 0,
  });

  const webhookUrl = `https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/uazapi-webhook`;

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Get recent webhook events
      const { data, error } = await supabase
        .from("webhook_events")
        .select("id, event_type, status, phone, processed, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setEvents(data || []);

      // Get stats
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { count: totalCount } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true });

      const { count: last24hCount } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last24h.toISOString());

      const { count: processedCount } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("processed", true);

      setStats({
        total: totalCount || 0,
        last24h: last24hCount || 0,
        processed: processedCount || 0,
      });
    } catch (error) {
      console.error("Error loading webhook events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copiada!",
      description: "A URL do webhook foi copiada para a área de transferência.",
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">N/A</Badge>;
    switch (status.toLowerCase()) {
      case "sent":
        return <Badge className="bg-blue-500">Enviada</Badge>;
      case "delivered":
        return <Badge className="bg-green-500">Entregue</Badge>;
      case "read":
        return <Badge className="bg-orange-500">Lida</Badge>;
      case "failed":
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const hasRecentWebhooks = stats.last24h > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Diagnóstico de Webhook
          </span>
          {hasRecentWebhooks ? (
            <Badge className="bg-green-500">Ativo</Badge>
          ) : (
            <Badge variant="destructive">Sem eventos</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Monitore os webhooks recebidos da UAZAPI para rastrear status de mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">URL do Webhook (configure na UAZAPI)</label>
          <div className="flex gap-2">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold">{stats.last24h}</p>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </div>
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold">{stats.processed}</p>
            <p className="text-xs text-muted-foreground">Processados</p>
          </div>
        </div>

        {/* Warning if no webhooks */}
        {!hasRecentWebhooks && (
          <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-destructive">Nenhum webhook recebido</p>
                <p className="text-sm text-muted-foreground">
                  Não estamos recebendo eventos da UAZAPI. Configure o webhook no painel da UAZAPI:
                </p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Acesse <a href="https://base360.uazapi.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">base360.uazapi.com</a></li>
                  <li>Vá em Configurações → Webhooks</li>
                  <li>Adicione a URL acima como webhook</li>
                  <li>Ative os eventos: <strong>messages.update</strong>, <strong>connection.update</strong></li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Recent events */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Eventos Recentes</label>
            <Button variant="ghost" size="sm" onClick={loadEvents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          
          {events.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground border rounded-lg">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum evento de webhook recebido ainda</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-3">
                    {event.processed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{event.event_type}</p>
                      {event.phone && (
                        <p className="text-xs text-muted-foreground">{event.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(event.status)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
