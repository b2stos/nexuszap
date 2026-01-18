/**
 * CampaignHealthPanel Component
 * 
 * Painel de saúde para monitorar status de webhooks e confirmações de entrega.
 * Mostra se o sistema está recebendo callbacks do provedor (delivered/read).
 * 
 * IMPORTANTE: 
 * - "Enviado" = HTTP 200 da API (accepted/queued)
 * - "Entregue" = webhook de status received do provedor
 * - "Pendente" = sem confirmação de webhook
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Webhook,
  RefreshCw,
  Activity,
  TrendingUp,
  Info,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface CampaignHealthPanelProps {
  campaignId: string;
  tenantId: string;
}

interface HealthStats {
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  pendingConfirmation: number; // sent but no webhook yet
  lastWebhookAt: string | null;
  webhookHealthy: boolean;
  minutesSinceLastWebhook: number | null;
}

export function CampaignHealthPanel({ campaignId, tenantId }: CampaignHealthPanelProps) {
  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['campaign-health', campaignId],
    queryFn: async (): Promise<HealthStats> => {
      // 1. Buscar contadores da campanha
      const { data: recipients, error: recipientsError } = await supabase
        .from('campaign_recipients')
        .select('status, sent_at, delivered_at, read_at, updated_at')
        .eq('campaign_id', campaignId);
      
      if (recipientsError) throw recipientsError;
      
      const totalSent = recipients?.filter(r => r.status === 'sent' || r.status === 'delivered' || r.status === 'read').length || 0;
      const delivered = recipients?.filter(r => r.status === 'delivered' || r.status === 'read').length || 0;
      const read = recipients?.filter(r => r.status === 'read').length || 0;
      const failed = recipients?.filter(r => r.status === 'failed').length || 0;
      
      // Mensagens "sent" mas sem delivered = pendente de confirmação
      const pendingConfirmation = recipients?.filter(r => r.status === 'sent').length || 0;
      
      // 2. Buscar último webhook de status recebido
      const { data: lastWebhook } = await supabase
        .from('mt_webhook_events')
        .select('received_at, event_type')
        .eq('tenant_id', tenantId)
        .ilike('event_type', '%status%')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const lastWebhookAt = lastWebhook?.received_at || null;
      let minutesSinceLastWebhook: number | null = null;
      let webhookHealthy = true;
      
      if (lastWebhookAt) {
        minutesSinceLastWebhook = differenceInMinutes(new Date(), new Date(lastWebhookAt));
        // Se enviamos mensagens e não recebemos webhook em 5+ minutos, não é saudável
        webhookHealthy = minutesSinceLastWebhook < 10 || totalSent === 0;
      } else if (totalSent > 0) {
        // Enviamos mas nunca recebemos webhook
        webhookHealthy = false;
      }
      
      return {
        totalSent,
        delivered,
        read,
        failed,
        pendingConfirmation,
        lastWebhookAt,
        webhookHealthy,
        minutesSinceLastWebhook,
      };
    },
    refetchInterval: 10000, // Atualiza a cada 10s
    staleTime: 5000,
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!stats) return null;
  
  const deliveryRate = stats.totalSent > 0 
    ? Math.round((stats.delivered / stats.totalSent) * 100) 
    : 0;
    
  const readRate = stats.delivered > 0 
    ? Math.round((stats.read / stats.delivered) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status de Entrega em Tempo Real
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-6 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Atualizado automaticamente a cada 10 segundos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-blue-500/10 text-center cursor-help">
                  <p className="text-lg font-bold text-blue-600">{stats.totalSent}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mensagens aceitas pelo provedor (HTTP 200)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-green-500/10 text-center cursor-help">
                  <p className="text-lg font-bold text-green-600">{stats.delivered}</p>
                  <p className="text-xs text-muted-foreground">Entregues</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Confirmação de entrega via webhook ({deliveryRate}%)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-2 rounded-lg bg-purple-500/10 text-center cursor-help">
                  <p className="text-lg font-bold text-purple-600">{stats.read}</p>
                  <p className="text-xs text-muted-foreground">Lidos</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Taxa de leitura: {readRate}% dos entregues</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`p-2 rounded-lg text-center cursor-help ${
                  stats.pendingConfirmation > 0 ? 'bg-orange-500/10' : 'bg-muted'
                }`}>
                  <p className={`text-lg font-bold ${
                    stats.pendingConfirmation > 0 ? 'text-orange-600' : 'text-muted-foreground'
                  }`}>
                    {stats.pendingConfirmation}
                  </p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Aguardando confirmação do provedor (webhook)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Webhook Health Indicator */}
        <div className={`p-3 rounded-lg flex items-center gap-3 ${
          stats.webhookHealthy ? 'bg-green-500/10' : 'bg-orange-500/10'
        }`}>
          <div className={`p-2 rounded-full ${
            stats.webhookHealthy ? 'bg-green-500/20' : 'bg-orange-500/20'
          }`}>
            {stats.webhookHealthy ? (
              <Webhook className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${
              stats.webhookHealthy ? 'text-green-700' : 'text-orange-700'
            }`}>
              {stats.webhookHealthy ? 'Webhooks Ativos' : 'Verificar Webhooks'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {stats.lastWebhookAt ? (
                <>Último: {formatDistanceToNow(new Date(stats.lastWebhookAt), { addSuffix: true, locale: ptBR })}</>
              ) : (
                'Nenhum webhook de status recebido ainda'
              )}
            </p>
          </div>
          {!stats.webhookHealthy && stats.pendingConfirmation > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-orange-600 flex-shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    Há {stats.pendingConfirmation} mensagens aguardando confirmação de entrega.
                    Se persistir, verifique a configuração do webhook no painel NotificaMe.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Alert for pending confirmations */}
        {!stats.webhookHealthy && stats.pendingConfirmation > 0 && stats.totalSent > 5 && (
          <Alert variant="default" className="bg-orange-500/5 border-orange-500/30">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-700">Confirmações Pendentes</AlertTitle>
            <AlertDescription className="text-sm text-orange-600/80">
              {stats.pendingConfirmation} de {stats.totalSent} mensagens não receberam 
              confirmação de entrega. Isso pode indicar:
              <ul className="list-disc list-inside mt-1 text-xs">
                <li>Webhook não configurado corretamente no NotificaMe</li>
                <li>Endpoint do webhook inacessível</li>
                <li>Atraso normal do provedor (aguarde alguns minutos)</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Delivery Rate Progress */}
        {stats.totalSent > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taxa de Entrega</span>
              <span className="font-medium">{deliveryRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${deliveryRate}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
