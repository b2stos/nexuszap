/**
 * MTCampaignsGrid - Grid de campanhas multi-tenant
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Send, 
  CheckCircle2, 
  Eye, 
  AlertCircle, 
  Trash2, 
  Play, 
  Pause,
  RotateCcw,
  XCircle,
  Clock,
  Loader2,
  FileText,
} from "lucide-react";
import { 
  useMTCampaigns, 
  useCurrentTenantForCampaigns,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  useDeleteMTCampaign,
  MTCampaign,
} from "@/hooks/useMTCampaigns";
import { CampaignDetailDialog } from "./CampaignDetailDialog";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Enviando",
  paused: "Pausada",
  done: "Concluída",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  scheduled: "bg-purple-500",
  running: "bg-blue-500 animate-pulse",
  paused: "bg-yellow-500",
  done: "bg-green-500",
  cancelled: "bg-red-500",
};

export function MTCampaignsGrid() {
  const queryClient = useQueryClient();
  const { data: tenantData } = useCurrentTenantForCampaigns();
  const tenantId = tenantData?.tenantId;
  
  const { data: campaigns, isLoading } = useMTCampaigns(tenantId);
  
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const cancelCampaign = useCancelCampaign();
  const deleteCampaign = useDeleteMTCampaign();
  
  const [selectedCampaign, setSelectedCampaign] = useState<MTCampaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const handleStart = async (campaign: MTCampaign) => {
    await startCampaign.mutateAsync({ campaignId: campaign.id });
  };
  
  const handlePause = async (campaign: MTCampaign) => {
    await pauseCampaign.mutateAsync({ campaignId: campaign.id });
  };
  
  const handleResume = async (campaign: MTCampaign) => {
    await resumeCampaign.mutateAsync({ campaignId: campaign.id });
  };
  
  const handleCancel = async (campaign: MTCampaign) => {
    await cancelCampaign.mutateAsync({ campaignId: campaign.id });
  };
  
  const handleDelete = async (campaign: MTCampaign) => {
    if (!tenantId) return;
    setDeletingId(campaign.id);
    try {
      await deleteCampaign.mutateAsync({ 
        campaignId: campaign.id, 
        tenantId,
      });
    } finally {
      setDeletingId(null);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="col-span-full text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhuma campanha criada</h3>
        <p className="text-muted-foreground mt-1">
          Crie sua primeira campanha para começar a enviar mensagens
        </p>
      </div>
    );
  }
  
  // Sort campaigns: running first, then paused, then others by date
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const statusOrder = { running: 0, paused: 1, scheduled: 2, draft: 3, done: 4, cancelled: 5 };
    const aOrder = statusOrder[a.status] ?? 6;
    const bOrder = statusOrder[b.status] ?? 6;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedCampaigns.map((campaign) => {
          const total = campaign.total_recipients || 0;
          const sent = campaign.sent_count || 0;
          const delivered = campaign.delivered_count || 0;
          const read = campaign.read_count || 0;
          const failed = campaign.failed_count || 0;
          const progress = total > 0 ? ((sent + failed) / total) * 100 : 0;
          
          const isRunning = campaign.status === 'running';
          const isPaused = campaign.status === 'paused';
          const isDraft = campaign.status === 'draft';
          const isDone = campaign.status === 'done';
          const isCancelled = campaign.status === 'cancelled';
          
          return (
            <Card key={campaign.id} className={`relative ${isRunning ? 'ring-2 ring-primary/50 ring-offset-2' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[campaign.status]}>
                      {statusLabels[campaign.status]}
                    </Badge>
                    {(isDraft || isDone || isCancelled) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === campaign.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a campanha "{campaign.name}"? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(campaign)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                
                {/* Template info */}
                {campaign.template && (
                  <Badge variant="outline" className="mt-2">
                    {campaign.template.name}
                  </Badge>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                {(isRunning || isPaused || isDone) && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
                
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Enviadas</p>
                      <p className="text-sm font-medium">{sent}/{total}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Entregues</p>
                      <p className="text-sm font-medium">{delivered}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Lidas</p>
                      <p className="text-sm font-medium">{read}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Falhas</p>
                      <p className="text-sm font-medium">{failed}</p>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  {isDraft && (
                    <Button 
                      size="sm" 
                      onClick={() => handleStart(campaign)}
                      disabled={startCampaign.isPending}
                      className="flex-1"
                    >
                      {startCampaign.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Iniciar
                        </>
                      )}
                    </Button>
                  )}
                  
                  {isRunning && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handlePause(campaign)}
                      disabled={pauseCampaign.isPending}
                      className="flex-1"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pausar
                    </Button>
                  )}
                  
                  {isPaused && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => handleResume(campaign)}
                        disabled={resumeCampaign.isPending}
                        className="flex-1"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Retomar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleCancel(campaign)}
                        disabled={cancelCampaign.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  
                  {(isDone || isCancelled) && failed > 0 && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedCampaign(campaign)}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Ver Falhas
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Detail Dialog - only render when a campaign is selected */}
      {selectedCampaign && (
        <CampaignDetailDialog
          campaign={selectedCampaign}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedCampaign(null);
          }}
        />
      )}
    </>
  );
}
