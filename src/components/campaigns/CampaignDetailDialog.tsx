/**
 * CampaignDetailDialog - Dialog com detalhes da campanha
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Send,
  CheckCircle2,
  Eye,
  AlertCircle,
  Clock,
  RefreshCw,
  Loader2,
  User,
  Phone,
} from "lucide-react";
import { 
  MTCampaign,
  useCampaignRecipients,
  useRetryFailedRecipients,
} from "@/hooks/useMTCampaigns";

interface CampaignDetailDialogProps {
  campaign: MTCampaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Enviando",
  paused: "Pausada",
  done: "Concluída",
  cancelled: "Cancelada",
};

const recipientStatusLabels: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  skipped: "Ignorada",
};

const recipientStatusColors: Record<string, string> = {
  queued: "bg-gray-500",
  sent: "bg-blue-500",
  delivered: "bg-green-500",
  read: "bg-emerald-500",
  failed: "bg-red-500",
  skipped: "bg-yellow-500",
};

export function CampaignDetailDialog({
  campaign,
  open,
  onOpenChange,
}: CampaignDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Only fetch data when we have a valid campaign
  const campaignId = campaign?.id;
  
  const { data: allRecipients, isLoading: loadingAll } = useCampaignRecipients(
    open ? campaignId : undefined
  );
  const { data: failedRecipients, isLoading: loadingFailed } = useCampaignRecipients(
    open ? campaignId : undefined, 
    'failed'
  );
  
  const retryFailed = useRetryFailedRecipients();
  
  // Early return if no campaign, but still render Dialog for controlled behavior
  if (!campaign) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Carregando...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }
  
  const total = campaign.total_recipients || 0;
  const sent = campaign.sent_count || 0;
  const delivered = campaign.delivered_count || 0;
  const read = campaign.read_count || 0;
  const failed = campaign.failed_count || 0;
  const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;
  
  const handleRetryFailed = async () => {
    await retryFailed.mutateAsync({ campaignId: campaign.id });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.name}
            <Badge variant="outline">{statusLabels[campaign.status]}</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="recipients">
              Destinatários ({total})
            </TabsTrigger>
            <TabsTrigger value="failures" className="relative">
              Falhas ({failed})
              {failed > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso do envio</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Send className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                <p className="text-2xl font-bold">{sent}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-2xl font-bold">{delivered}</p>
                <p className="text-xs text-muted-foreground">Entregues</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Eye className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-2xl font-bold">{read}</p>
                <p className="text-xs text-muted-foreground">Lidas</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <AlertCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <p className="text-2xl font-bold">{failed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>
            
            {/* Details */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Template:</span>
                <span>{campaign.template?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Canal:</span>
                <span>{campaign.channel?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Criada em:</span>
                <span>{new Date(campaign.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {campaign.started_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Iniciada em:</span>
                  <span>{new Date(campaign.started_at).toLocaleString("pt-BR")}</span>
                </div>
              )}
              {campaign.completed_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Concluída em:</span>
                  <span>{new Date(campaign.completed_at).toLocaleString("pt-BR")}</span>
                </div>
              )}
            </div>
            
            {/* Rates */}
            {total > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {total > 0 ? ((sent / total) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Taxa de Envio</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {sent > 0 ? ((delivered / sent) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {delivered > 0 ? ((read / delivered) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Taxa de Leitura</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Recipients Tab */}
          <TabsContent value="recipients">
            <ScrollArea className="h-[400px]">
              {loadingAll ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !allRecipients || allRecipients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum destinatário encontrado
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {allRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {recipient.contact?.name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {recipient.contact?.phone}
                          </p>
                        </div>
                      </div>
                      <Badge className={recipientStatusColors[recipient.status]}>
                        {recipientStatusLabels[recipient.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          {/* Failures Tab */}
          <TabsContent value="failures">
            {failed > 0 && (campaign.status === 'done' || campaign.status === 'paused') && (
              <div className="mb-4">
                <Button
                  onClick={handleRetryFailed}
                  disabled={retryFailed.isPending}
                  className="w-full"
                >
                  {retryFailed.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reenviar {failed} mensagem(ns) com falha
                </Button>
              </div>
            )}
            
            <ScrollArea className="h-[350px]">
              {loadingFailed ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !failedRecipients || failedRecipients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  <p>Nenhuma falha registrada</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {failedRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {recipient.contact?.name || 'Sem nome'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {recipient.contact?.phone}
                        </span>
                      </div>
                      {recipient.last_error && (
                        <p className="text-xs text-red-500">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {recipient.last_error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
