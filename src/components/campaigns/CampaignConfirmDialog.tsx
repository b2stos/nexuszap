/**
 * CampaignConfirmDialog - Modal de confirmação antes de iniciar campanha
 * 
 * Mostra resumo da campanha e requer confirmação do usuário
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Users, FileText, Smartphone, Gauge, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CampaignSummary {
  name: string;
  channelName: string;
  channelPhone: string | null;
  templateName: string;
  templateCategory: string;
  recipientCount: number;
  bmLimit: number | null; // null = unlimited
  sentLast24h: number;
  sendSpeed: 'slow' | 'normal' | 'fast';
}

interface CampaignConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: CampaignSummary;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

const speedLabels: Record<string, { label: string; estimate: string }> = {
  slow: { label: 'Lento', estimate: '~3 segundos/mensagem' },
  normal: { label: 'Normal', estimate: '~1.5 segundos/mensagem' },
  fast: { label: 'Rápido', estimate: '~0.8 segundos/mensagem' },
};

export function CampaignConfirmDialog({
  open,
  onOpenChange,
  summary,
  onConfirm,
  isLoading,
}: CampaignConfirmDialogProps) {
  const [understood, setUnderstood] = useState(false);
  
  // Calculate how many will be sent now vs later
  const remainingLimit = summary.bmLimit 
    ? Math.max(0, summary.bmLimit - summary.sentLast24h)
    : Infinity;
  
  const willSendNow = Math.min(summary.recipientCount, remainingLimit);
  const willSendLater = summary.recipientCount - willSendNow;
  
  // Estimate time
  const secondsPerMsg = summary.sendSpeed === 'slow' ? 3 : summary.sendSpeed === 'fast' ? 0.8 : 1.5;
  const estimatedMinutes = Math.ceil((willSendNow * secondsPerMsg) / 60);
  
  const handleConfirm = async () => {
    await onConfirm();
  };
  
  const handleClose = () => {
    if (!isLoading) {
      setUnderstood(false);
      onOpenChange(false);
    }
  };
  
  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Confirmar Disparo
          </AlertDialogTitle>
          <AlertDialogDescription>
            Revise os detalhes da campanha antes de iniciar o envio.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Campaign Details */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
            {/* Name */}
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Campanha</span>
                <p className="font-medium">{summary.name}</p>
              </div>
            </div>
            
            {/* Channel */}
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Canal</span>
                <p className="font-medium">
                  {summary.channelName}
                  {summary.channelPhone && (
                    <span className="text-muted-foreground text-sm ml-2">
                      ({summary.channelPhone})
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            {/* Template */}
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Template</span>
                <p className="font-medium flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {summary.templateCategory}
                  </Badge>
                  {summary.templateName}
                </p>
              </div>
            </div>
            
            {/* Recipients */}
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Destinatários</span>
                <p className="font-medium">
                  {summary.recipientCount.toLocaleString('pt-BR')} contato(s)
                </p>
              </div>
            </div>
            
            {/* Speed */}
            <div className="flex items-center gap-3">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground">Velocidade</span>
                <p className="font-medium">
                  {speedLabels[summary.sendSpeed].label}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({speedLabels[summary.sendSpeed].estimate})
                  </span>
                </p>
              </div>
            </div>
          </div>
          
          {/* BM Limit Info */}
          {summary.bmLimit && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-800 dark:text-blue-200">
                    Limite BM (24h): <strong>{summary.bmLimit.toLocaleString('pt-BR')}</strong>
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    Já enviados: {summary.sentLast24h.toLocaleString('pt-BR')} | 
                    Restante: {remainingLimit.toLocaleString('pt-BR')}
                  </p>
                  {willSendLater > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                      ⚠️ {willSendLater.toLocaleString('pt-BR')} contatos ficarão pendentes para próximo ciclo
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Summary */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Serão enviados agora</p>
                <p className="text-2xl font-bold text-primary">
                  {willSendNow.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Tempo estimado</p>
                <p className="font-medium text-foreground">~{estimatedMinutes} minuto(s)</p>
              </div>
            </div>
          </div>
          
          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-primary text-primary focus:ring-primary"
            />
            <span className="text-sm leading-tight">
              Entendo que o envio é de minha responsabilidade e que devo respeitar as políticas 
              do WhatsApp Business e do meu número/BM.
            </span>
          </label>
        </div>
        
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!understood || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar e Iniciar
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
