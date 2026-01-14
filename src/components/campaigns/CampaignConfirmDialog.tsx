/**
 * CampaignConfirmDialog - Modal FULLSCREEN de confirmação antes de iniciar campanha
 * 
 * Mostra resumo da campanha e requer confirmação do usuário
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, Users, FileText, Smartphone, Gauge, AlertTriangle, CheckCircle2, X, Clock, Zap } from "lucide-react";

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

const speedLabels: Record<string, { label: string; estimate: string; color: string }> = {
  slow: { label: 'Lento', estimate: '~3 seg/msg', color: 'text-blue-600' },
  normal: { label: 'Normal', estimate: '~1.5 seg/msg', color: 'text-amber-600' },
  fast: { label: 'Rápido', estimate: '~0.8 seg/msg', color: 'text-green-600' },
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

  const canStart = understood && summary.recipientCount > 0;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-none w-screen h-screen max-h-screen p-0 gap-0 rounded-none border-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-background shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  Confirmar Disparo da Campanha
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Revise os detalhes antes de iniciar o envio em massa
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-muted/30">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Campaign Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Resumo da Campanha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Campanha</span>
                    <p className="font-semibold text-lg mt-1">{summary.name}</p>
                  </div>
                  
                  {/* Channel */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> Canal
                    </span>
                    <p className="font-semibold mt-1">
                      {summary.channelName}
                      {summary.channelPhone && (
                        <span className="text-muted-foreground text-sm ml-2">
                          ({summary.channelPhone})
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Template */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Template</span>
                    <p className="font-semibold mt-1 flex items-center gap-2">
                      {summary.templateName}
                      <Badge variant="secondary" className="text-xs">
                        {summary.templateCategory}
                      </Badge>
                    </p>
                  </div>
                  
                  {/* Speed */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Gauge className="h-3 w-3" /> Velocidade
                    </span>
                    <p className={`font-semibold mt-1 flex items-center gap-2 ${speedLabels[summary.sendSpeed].color}`}>
                      <Zap className="h-4 w-4" />
                      {speedLabels[summary.sendSpeed].label}
                      <span className="text-muted-foreground text-sm font-normal">
                        ({speedLabels[summary.sendSpeed].estimate})
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Recipients & Limits Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Destinatários e Limites
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-xs text-muted-foreground uppercase">Total Selecionados</p>
                    <p className="text-3xl font-bold text-primary mt-1">
                      {summary.recipientCount.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-xs text-muted-foreground uppercase">Serão Enviados Agora</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {willSendNow.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted/50 border text-center">
                    <p className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> Tempo Estimado
                    </p>
                    <p className="text-3xl font-bold mt-1">
                      ~{estimatedMinutes} <span className="text-lg font-normal text-muted-foreground">min</span>
                    </p>
                  </div>
                </div>
                
                {/* BM Limit Info */}
                {summary.bmLimit && (
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          Limite BM (24h): {summary.bmLimit.toLocaleString('pt-BR')} mensagens
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Já enviadas hoje: {summary.sentLast24h.toLocaleString('pt-BR')} | 
                          Restante disponível: {remainingLimit.toLocaleString('pt-BR')}
                        </p>
                        {willSendLater > 0 && (
                          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-2">
                            ⚠️ {willSendLater.toLocaleString('pt-BR')} contatos ficarão pendentes para o próximo ciclo de 24h
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Confirmation Card */}
            <Card className="border-primary/30">
              <CardContent className="pt-6">
                <label className="flex items-start gap-4 cursor-pointer group">
                  <Checkbox
                    checked={understood}
                    onCheckedChange={(checked) => setUnderstood(checked === true)}
                    className="mt-0.5 h-5 w-5"
                  />
                  <div className="space-y-1">
                    <p className="font-medium leading-tight group-hover:text-primary transition-colors">
                      Confirmo que entendo a responsabilidade do envio
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Declaro que o envio é de minha responsabilidade e que devo respeitar as políticas 
                      do WhatsApp Business, incluindo os limites do meu número/Business Manager e as 
                      diretrizes de conteúdo.
                    </p>
                  </div>
                </label>
                
                {!understood && (
                  <p className="text-xs text-amber-600 mt-3 ml-9">
                    ⚠️ Marque a caixa acima para habilitar o botão de iniciar
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Footer - Sticky */}
        <div className="px-6 py-4 border-t bg-background shrink-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {canStart 
                ? `✓ Pronto para enviar ${willSendNow.toLocaleString('pt-BR')} mensagens`
                : 'Confirme a responsabilidade para continuar'
              }
            </p>
            
            <div className="flex items-center gap-3 ml-auto">
              <Button
                variant="outline"
                size="lg"
                onClick={handleClose}
                disabled={isLoading}
                className="min-w-[120px]"
              >
                Cancelar
              </Button>
              
              <Button
                size="lg"
                onClick={handleConfirm}
                disabled={!canStart || isLoading}
                className="min-w-[180px] gap-2 text-base font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Iniciar Campanha
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
