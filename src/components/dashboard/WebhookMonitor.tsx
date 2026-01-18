import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookEvent {
  id: string;
  event_type: string;
  phone: string | null;
  status: string | null;
  payload: any;
  processed: boolean;
  created_at: string;
}

export function WebhookMonitor() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    pending: 0,
    last24h: 0
  });

  useEffect(() => {
    // Load initial events
    loadEvents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('webhook-events-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webhook_events'
        },
        (payload) => {
          console.log('New webhook event:', payload);
          setEvents(prev => [payload.new as WebhookEvent, ...prev].slice(0, 50));
          updateStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'webhook_events'
        },
        (payload) => {
          console.log('Updated webhook event:', payload);
          setEvents(prev => 
            prev.map(e => e.id === payload.new.id ? payload.new as WebhookEvent : e)
          );
          updateStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEvents = async () => {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setEvents(data);
      updateStats();
    }
  };

  const updateStats = async () => {
    const { count: total } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true });

    const { count: processed } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true);

    const { count: pending } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { count: last24h } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    setStats({
      total: total || 0,
      processed: processed || 0,
      pending: pending || 0,
      last24h: last24h || 0
    });
  };

  const getStatusIcon = (processed: boolean) => {
    return processed ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <Clock className="h-4 w-4 text-yellow-500" />
    );
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'SENT': 'outline',
      'ENVIADA': 'outline',
      'DELIVERED': 'secondary',
      'ENTREGUE': 'secondary',
      'READ': 'default',
      'LIDA': 'default',
      'FAILED': 'destructive',
      'FALHA': 'destructive',
    };

    return (
      <Badge variant={variants[status.toUpperCase()] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Webhooks
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Processados
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Últimas 24h
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.last24h}</div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks Recebidos (Tempo Real)</CardTitle>
        <CardDescription>
          Últimos eventos de status do seu canal WhatsApp
        </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum webhook recebido ainda</p>
                  <p className="text-sm mt-1">
                    Verifique a configuração do webhook no seu canal
                  </p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="mt-1">
                      {getStatusIcon(event.processed)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{event.event_type}</span>
                        {event.status && getStatusBadge(event.status)}
                      </div>
                      {event.phone && (
                        <p className="text-sm text-muted-foreground">
                          Telefone: {event.phone}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant={event.processed ? "default" : "secondary"}>
                        {event.processed ? "Processado" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
