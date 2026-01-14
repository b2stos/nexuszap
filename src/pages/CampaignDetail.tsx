/**
 * CampaignDetail - Página de detalhes e progresso da campanha
 * 
 * Mostra status, contadores, barra de progresso e lista de destinatários
 * Com polling ativo, última atualização, e botão de refresh manual
 * **NEW: Exibe alertas de canal desconectado e erros recentes**
 * **NEW: Debug Panel para diagnóstico de erros de envio**
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  ArrowLeft, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Users,
  Send,
  Eye,
  AlertTriangle,
  Smartphone,
  FileText,
  AlertCircle,
  Unplug,
  Settings,
} from "lucide-react";
import { 
  useMTCampaign, 
  useCampaignRecipients, 
  useStartCampaign, 
  usePauseCampaign, 
  useResumeCampaign, 
  useRetryFailedRecipients,
  useProcessCampaignBatch 
} from "@/hooks/useMTCampaigns";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CampaignDebugPanel, DebugInfo } from "@/components/campaigns/CampaignDebugPanel";
import { serializeError, extractTraceId, createPayloadSummary } from "@/hooks/useCampaignDebug";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', color: 'bg-gray-500', icon: <Clock className="h-4 w-4" /> },
  scheduled: { label: 'Agendada', color: 'bg-blue-500', icon: <Clock className="h-4 w-4" /> },
  running: { label: 'Enviando', color: 'bg-green-500', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  paused: { label: 'Pausada', color: 'bg-yellow-500', icon: <Pause className="h-4 w-4" /> },
  done: { label: 'Concluída', color: 'bg-emerald-500', icon: <CheckCircle2 className="h-4 w-4" /> },
  cancelled: { label: 'Cancelada', color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
};

const recipientStatusConfig: Record<string, { label: string; color: string }> = {
  queued: { label: 'Na fila', color: 'bg-gray-500' },
  sent: { label: 'Enviado', color: 'bg-blue-500' },
  delivered: { label: 'Entregue', color: 'bg-green-500' },
  read: { label: 'Lido', color: 'bg-emerald-500' },
  failed: { label: 'Falhou', color: 'bg-red-500' },
  skipped: { label: 'Ignorado', color: 'bg-yellow-500' },
};

export default function CampaignDetail() {
  const user = useProtectedUser();
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Track last update time and stall detection
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [lastProcessedCount, setLastProcessedCount] = useState<number>(0);
  const [stallWarning, setStallWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'queued' | 'sent' | 'failed'>('all');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  
  // Fetch campaign data
  const { data: campaign, isLoading: campaignLoading, refetch: refetchCampaign } = useMTCampaign(campaignId);
  const { data: recipients, isLoading: recipientsLoading, refetch: refetchRecipients } = useCampaignRecipients(
    campaignId,
    recipientFilter === 'all' ? undefined : recipientFilter
  );
  
  // Fetch failed recipients for error display
  const { data: failedRecipients } = useCampaignRecipients(campaignId, 'failed');
  
  // Mutations
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const retryFailed = useRetryFailedRecipients();
  const processBatch = useProcessCampaignBatch();
  
  // Calculate progress
  const total = campaign?.total_recipients || 0;
  const sent = campaign?.sent_count || 0;
  const delivered = campaign?.delivered_count || 0;
  const read = campaign?.read_count || 0;
  const failed = campaign?.failed_count || 0;
  const processed = sent + failed;
  const queued = total - processed;
  const progressPercent = total > 0 ? (processed / total) * 100 : 0;
  
  // Detect channel issues
  const isChannelDisconnected = campaign?.channel?.status !== 'connected';
  
  // Detect token errors in failed recipients
  const tokenErrors = useMemo(() => {
    if (!failedRecipients) return [];
    return failedRecipients.filter(r => 
      r.last_error?.toLowerCase().includes('token') ||
      r.last_error?.toLowerCase().includes('invalid') ||
      r.last_error?.toLowerCase().includes('expirado') ||
      r.last_error?.toLowerCase().includes('401') ||
      r.last_error?.toLowerCase().includes('403')
    );
  }, [failedRecipients]);
  
  const hasTokenError = tokenErrors.length > 0;
  
  // Get recent errors (max 10)
  const recentErrors = useMemo(() => {
    if (!failedRecipients) return [];
    return failedRecipients.slice(0, 10);
  }, [failedRecipients]);
  
  // Determine if campaign is stuck (paused with queued items and errors)
  const isCampaignStuck = campaign?.status === 'paused' && queued > 0 && (hasTokenError || isChannelDisconnected);
  
  // Detect stall (no progress in 30 seconds while running)
  useEffect(() => {
    if (campaign?.status !== 'running') {
      setStallWarning(false);
      return;
    }
    
    const currentProcessed = sent + failed;
    
    if (currentProcessed !== lastProcessedCount) {
      // Progress made - reset stall timer
      setLastProcessedCount(currentProcessed);
      setLastUpdateTime(new Date());
      setStallWarning(false);
    } else {
      // Check if stalled (30 seconds without progress)
      const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
      if (timeSinceLastUpdate > 30000 && queued > 0) {
        setStallWarning(true);
      }
    }
  }, [campaign?.status, sent, failed, lastProcessedCount, lastUpdateTime, queued]);
  
  // Auto-trigger next batch when running (continues processing)
  useEffect(() => {
    // ONLY trigger if campaign is actively running
    if (campaign?.status !== 'running' || !campaignId) {
      return;
    }
    
    // Only trigger if there are queued items and not already processing
    if (queued > 0 && !processBatch.isPending) {
      const timer = setTimeout(() => {
        // Double-check status before triggering (prevent race conditions)
        if (campaign?.status === 'running') {
          console.log('[CampaignDetail] Auto-triggering next batch...');
          processBatch.mutate({ campaignId, speed: 'normal' });
        }
      }, 5000); // Wait 5 seconds between batches
      
      return () => clearTimeout(timer);
    }
  }, [campaign?.status, campaignId, queued, processBatch.isPending]);
  
  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchCampaign(), refetchRecipients()]);
      setLastUpdateTime(new Date());
      setStallWarning(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchCampaign, refetchRecipients]);
  
  // Force process next batch
  const handleForceProcess = useCallback(async () => {
    if (!campaignId) return;
    await processBatch.mutateAsync({ campaignId, speed: 'normal' });
    await handleRefresh();
  }, [campaignId, processBatch, handleRefresh]);
  
  if (campaignLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando campanha...</span>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!campaign) {
    return (
      <DashboardLayout user={user}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-muted-foreground">Campanha não encontrada</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/dashboard/campaigns")}
            >
              Voltar para Campanhas
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }
  
  const status = statusConfig[campaign.status] || statusConfig.draft;
  
  // Handle actions with debug capture
  const handleStart = async () => {
    if (!campaignId) return;
    
    const startTime = Date.now();
    const endpoint = `/functions/v1/campaign-start`;
    
    try {
      const result = await startCampaign.mutateAsync({ campaignId });
      
      // Captura debug de sucesso
      setDebugInfo({
        timestamp: new Date().toISOString(),
        endpoint,
        method: 'POST',
        status: 200,
        statusText: 'OK',
        responseRaw: JSON.stringify(result, null, 2),
        traceId: extractTraceId(result),
        payloadSummary: createPayloadSummary({ campaignId }),
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      // Captura debug de erro
      const serialized = serializeError(error);
      setDebugInfo({
        timestamp: new Date().toISOString(),
        endpoint,
        method: 'POST',
        status: serialized.status,
        traceId: serialized.traceId,
        errorName: serialized.name,
        errorMessage: serialized.message,
        errorStack: serialized.stack,
        errorCause: serialized.cause,
        payloadSummary: createPayloadSummary({ campaignId }),
        durationMs: Date.now() - startTime,
      });
    }
  };
  
  const handlePause = async () => {
    if (campaignId) {
      await pauseCampaign.mutateAsync({ campaignId });
    }
  };
  
  const handleResume = async () => {
    if (campaignId) {
      await resumeCampaign.mutateAsync({ campaignId });
    }
  };
  
  const handleRetryFailed = async () => {
    if (campaignId) {
      await retryFailed.mutateAsync({ campaignId });
    }
  };
  
  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard/campaigns")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{campaign.name}</h2>
              <p className="text-sm text-muted-foreground">
                Criada {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Last update time + refresh button */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Atualizado: {format(lastUpdateTime, 'HH:mm:ss', { locale: ptBR })}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <Badge className={`${status.color} text-white gap-1.5`}>
              {status.icon}
              {status.label}
            </Badge>
          </div>
        </div>
        
        {/* Stall Warning */}
        {stallWarning && (
          <Card className="border-amber-500 bg-amber-500/10">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-700">Envio sem atualização há mais de 30 segundos</p>
                  <p className="text-sm text-amber-600">Verifique a integração ou clique para forçar processamento</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleForceProcess}
                disabled={processBatch.isPending}
                className="border-amber-500 text-amber-700 hover:bg-amber-500/20"
              >
                {processBatch.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Forçar Processamento
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Channel Disconnected Alert */}
        {isChannelDisconnected && (
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Unplug className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-700">Canal Desconectado</p>
                  <p className="text-sm text-red-600">
                    O canal "{campaign.channel?.name}" não está conectado. O envio não funcionará.
                  </p>
                </div>
              </div>
              <Button 
                asChild
                variant="outline" 
                size="sm" 
                className="border-red-500 text-red-700 hover:bg-red-500/20"
              >
                <Link to="/dashboard/channels">
                  <Settings className="h-4 w-4 mr-2" />
                  Reconectar
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Token Error Alert */}
        {hasTokenError && !isChannelDisconnected && (
          <Card className="border-orange-500 bg-orange-500/10">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-700">Token Inválido ou Expirado</p>
                  <p className="text-sm text-orange-600">
                    O envio foi pausado porque o token do canal está inválido. Reconecte o canal.
                  </p>
                </div>
              </div>
              <Button 
                asChild
                variant="outline" 
                size="sm" 
                className="border-orange-500 text-orange-700 hover:bg-orange-500/20"
              >
                <Link to="/dashboard/channels">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Canal
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Campaign Stuck Alert */}
        {isCampaignStuck && (
          <Card className="border-yellow-500 bg-yellow-500/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-700">Campanha Pausada</p>
                <p className="text-sm text-yellow-600">
                  Ainda há {queued} contatos na fila. Corrija o problema do canal e clique em "Retomar".
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Debug Panel - Sempre visível quando há info */}
        <CampaignDebugPanel debugInfo={debugInfo} />
        
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Users className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{total.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sent.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{delivered.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Entregues</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                  <Eye className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{read.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Lidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{failed.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Progress Bar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Progresso do Envio</CardTitle>
              {campaign.status === 'running' && (
                <Badge variant="outline" className="text-green-600 border-green-300 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Processando
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{processed} de {total} processados</span>
              <span className="font-bold text-primary">{progressPercent.toFixed(1)}%</span>
            </div>
            <Progress value={progressPercent} className="h-4" />
            
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {queued > 0 && campaign.status !== 'done' ? (
                <p className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {queued.toLocaleString('pt-BR')} contatos aguardando na fila
                </p>
              ) : (
                <p className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos processados
                </p>
              )}
              
              {campaign.status === 'running' && processBatch.isPending && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Enviando lote...
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Campaign Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Campanha</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Canal</p>
                <p className="font-medium">{campaign.channel?.name || 'N/A'}</p>
                {campaign.channel?.phone_number && (
                  <p className="text-xs text-muted-foreground">{campaign.channel.phone_number}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Template</p>
                <p className="font-medium">{campaign.template?.name || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {campaign.status === 'draft' && (
              <Button onClick={handleStart} disabled={startCampaign.isPending} className="gap-2">
                {startCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Iniciar Envio
              </Button>
            )}
            
            {campaign.status === 'running' && (
              <Button onClick={handlePause} disabled={pauseCampaign.isPending} variant="outline" className="gap-2">
                {pauseCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                Pausar
              </Button>
            )}
            
            {campaign.status === 'paused' && (
              <Button onClick={handleResume} disabled={resumeCampaign.isPending} className="gap-2">
                {resumeCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Retomar
              </Button>
            )}
            
            {failed > 0 && (
              <Button onClick={handleRetryFailed} disabled={retryFailed.isPending} variant="secondary" className="gap-2">
                {retryFailed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reenviar Falhas ({failed})
              </Button>
            )}
          </CardContent>
        </Card>
        
        {/* Recipients List with Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Destinatários</CardTitle>
                <CardDescription>
                  Lista de contatos e status de entrega
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={recipientFilter} onValueChange={(v) => setRecipientFilter(v as typeof recipientFilter)}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  Todos ({total})
                </TabsTrigger>
                <TabsTrigger value="queued">
                  Pendentes ({queued})
                </TabsTrigger>
                <TabsTrigger value="sent">
                  Enviados ({sent})
                </TabsTrigger>
                <TabsTrigger value="failed">
                  Falhas ({failed})
                </TabsTrigger>
              </TabsList>
        
        {/* Recent Errors Section */}
        {recentErrors.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg text-red-700">Erros Recentes ({failed})</CardTitle>
              </div>
              <CardDescription>
                Últimos erros de envio - verifique os motivos abaixo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recentErrors.map((recipient) => (
                  <div 
                    key={recipient.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {recipient.contact?.name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {recipient.contact?.phone}
                      </p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm text-red-600 font-medium truncate" title={recipient.last_error || undefined}>
                        {recipient.last_error || 'Erro desconhecido'}
                      </p>
                      {recipient.updated_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(recipient.updated_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
              <TabsContent value={recipientFilter} className="mt-0">
                {recipientsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recipients && recipients.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {recipients.map((recipient) => {
                      const recStatus = recipientStatusConfig[recipient.status] || recipientStatusConfig.queued;
                      return (
                        <div 
                          key={recipient.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">
                                {recipient.contact?.name || 'Sem nome'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {recipient.contact?.phone}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {recipient.last_error && (
                              <span className="text-xs text-red-500 max-w-[200px] truncate" title={recipient.last_error}>
                                {recipient.last_error}
                              </span>
                            )}
                            {recipient.updated_at && (
                              <span className="text-xs text-muted-foreground hidden sm:block">
                                {format(new Date(recipient.updated_at), 'HH:mm:ss', { locale: ptBR })}
                              </span>
                            )}
                            <Badge variant="secondary" className={`${recStatus.color} text-white`}>
                              {recStatus.label}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum destinatário encontrado
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
