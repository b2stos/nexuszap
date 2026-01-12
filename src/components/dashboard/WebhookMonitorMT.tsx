/**
 * WebhookMonitorMT Component
 * 
 * Monitor de webhooks para tabela mt_webhook_events (multi-tenant)
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  Webhook,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Clock,
  MessageCircle,
  Send,
  Filter,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentTenantForChannels, useChannels } from '@/hooks/useChannels';

interface WebhookEvent {
  id: string;
  tenant_id: string | null;
  channel_id: string | null;
  provider: string;
  event_type: string;
  payload_raw: unknown;
  message_id: string | null;
  processed: boolean;
  processing_error: string | null;
  received_at: string;
  ip_address?: string | null;
  is_invalid?: boolean | null;
  invalid_reason?: string | null;
  rate_limited?: boolean | null;
}

function EventTypeBadge({ type }: { type: string }) {
  if (type.includes('inbound') || type.includes('message')) {
    return (
      <Badge variant="secondary" className="text-xs">
        <MessageCircle className="w-3 h-3 mr-1" />
        Recebida
      </Badge>
    );
  }
  if (type.includes('status')) {
    return (
      <Badge variant="outline" className="text-xs">
        <Send className="w-3 h-3 mr-1" />
        Status
      </Badge>
    );
  }
  return <Badge variant="secondary" className="text-xs">{type}</Badge>;
}

function StatusBadge({ processed, error }: { processed: boolean; error: string | null }) {
  if (error) {
    return <Badge variant="destructive" className="text-xs">Erro</Badge>;
  }
  if (processed) {
    return <Badge className="bg-green-500 text-xs">Processado</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">Pendente</Badge>;
}

function EventRow({ event, expanded, onToggle }: { 
  event: WebhookEvent; 
  expanded: boolean; 
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {event.processing_error ? (
            <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          ) : event.processed ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <EventTypeBadge type={event.event_type} />
              <StatusBadge processed={event.processed} error={event.processing_error} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(event.received_at), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.received_at), 'HH:mm:ss')}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2">
          {/* Event metadata */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 bg-muted rounded">
              <strong>ID:</strong> {event.id.substring(0, 8)}...
            </span>
            {event.channel_id && (
              <span className="px-2 py-0.5 bg-muted rounded">
                <strong>Canal:</strong> {event.channel_id.substring(0, 8)}...
              </span>
            )}
            {!event.channel_id && (
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-700 rounded">
                Sem canal (teste)
              </span>
            )}
          </div>
          
          {event.processing_error && (
            <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
              <strong>Erro:</strong> {event.processing_error}
            </div>
          )}
          
          {event.invalid_reason && (
            <div className="p-2 bg-orange-500/10 rounded text-sm text-orange-700">
              <strong>Inválido:</strong> {event.invalid_reason}
            </div>
          )}
          
          <div className="bg-muted rounded p-2 overflow-x-auto">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(event.payload_raw, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function WebhookMonitorMT() {
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const { data: tenantData } = useCurrentTenantForChannels();
  const { data: channels = [] } = useChannels(tenantData?.tenantId);
  
  const { data: events = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mt-webhook-events', tenantData?.tenantId, channelFilter, typeFilter],
    queryFn: async () => {
      // Fetch all events for this tenant, or all events if no tenant filter (for debugging)
      let query = supabase
        .from('mt_webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50);

      // Filter by tenant if available, but also show events without tenant (test events)
      if (tenantData?.tenantId) {
        query = query.or(`tenant_id.eq.${tenantData.tenantId},tenant_id.is.null`);
      }

      if (channelFilter !== 'all') {
        query = query.eq('channel_id', channelFilter);
      }
      
      if (typeFilter !== 'all') {
        query = query.ilike('event_type', `%${typeFilter}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WebhookEvent[];
    },
    enabled: true, // Always enabled to show test events
    refetchInterval: 5000, // Refresh every 5s for faster feedback
  });

  // Stats
  const stats = {
    total: events.length,
    processed: events.filter(e => e.processed && !e.processing_error).length,
    errors: events.filter(e => e.processing_error).length,
    pending: events.filter(e => !e.processed && !e.processing_error).length,
  };

  if (!tenantData?.tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Monitor de Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma organização encontrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Monitor de Webhooks
            </CardTitle>
            <CardDescription>
              Eventos recebidos do BSP NotificaMe
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <p className="text-xl font-bold text-green-600">{stats.processed}</p>
            <p className="text-xs text-muted-foreground">Processados</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10 text-center">
            <p className="text-xl font-bold text-destructive">{stats.errors}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-500/10 text-center">
            <p className="text-xl font-bold text-orange-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtros:</span>
          </div>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {channels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  {ch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="inbound">Mensagens</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Events List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum evento recebido</p>
            <p className="text-sm">
              {channelFilter !== 'all' || typeFilter !== 'all' 
                ? 'Tente alterar os filtros' 
                : 'Configure o webhook no BSP para começar a receber eventos'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="border rounded-lg">
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
