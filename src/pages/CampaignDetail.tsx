/**
 * CampaignDetail - Página de detalhes e progresso da campanha
 * 
 * Mostra status, contadores, barra de progresso e lista de destinatários
 */

import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { useMTCampaign, useCampaignRecipients, useStartCampaign, usePauseCampaign, useResumeCampaign, useRetryFailedRecipients } from "@/hooks/useMTCampaigns";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  
  // Fetch campaign data
  const { data: campaign, isLoading: campaignLoading } = useMTCampaign(campaignId);
  const { data: recipients, isLoading: recipientsLoading } = useCampaignRecipients(campaignId);
  
  // Mutations
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const retryFailed = useRetryFailedRecipients();
  
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
  
  // Calculate progress
  const total = campaign.total_recipients || 0;
  const sent = campaign.sent_count || 0;
  const delivered = campaign.delivered_count || 0;
  const read = campaign.read_count || 0;
  const failed = campaign.failed_count || 0;
  const queued = total - sent - failed;
  const progressPercent = total > 0 ? ((sent + failed) / total) * 100 : 0;
  
  const status = statusConfig[campaign.status] || statusConfig.draft;
  
  // Handle actions
  const handleStart = async () => {
    if (campaignId) {
      await startCampaign.mutateAsync({ campaignId });
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
          
          <Badge className={`${status.color} text-white gap-1.5`}>
            {status.icon}
            {status.label}
          </Badge>
        </div>
        
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
          <CardHeader>
            <CardTitle className="text-lg">Progresso do Envio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{sent + failed} de {total} processados</span>
              <span className="font-medium">{progressPercent.toFixed(1)}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            
            {queued > 0 && campaign.status !== 'done' && (
              <p className="text-sm text-muted-foreground">
                <Clock className="inline h-4 w-4 mr-1" />
                {queued.toLocaleString('pt-BR')} contatos aguardando na fila
              </p>
            )}
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
        
        {/* Recipients List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Destinatários</CardTitle>
            <CardDescription>
              Lista de contatos e status de entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
