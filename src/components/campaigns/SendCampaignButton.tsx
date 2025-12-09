import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignProgress } from "./CampaignProgress";

interface SendCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  status: string;
  onStatusChange?: () => void;
}

export function SendCampaignButton({ 
  campaignId, 
  campaignName, 
  status,
  onStatusChange 
}: SendCampaignButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const handleSend = async (resend: boolean = false) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-messages", {
        body: { 
          campaignId,
          resend,
        },
      });

      if (error) throw error;

      // Show progress dialog
      setShowProgress(true);

      const action = resend ? "reenviada" : "iniciada";
      toast({
        title: `Campanha ${action}!`,
        description: data.message || `Enviando mensagens em segundo plano...`,
      });

      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProgressComplete = () => {
    onStatusChange?.();
  };

  // Show progress dialog for sending campaigns
  if (status === 'sending') {
    return (
      <>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => setShowProgress(true)}
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Ver Progresso
        </Button>

        <Dialog open={showProgress} onOpenChange={setShowProgress}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{campaignName}</DialogTitle>
              <DialogDescription>
                Acompanhe o progresso do envio em tempo real
              </DialogDescription>
            </DialogHeader>
            <CampaignProgress 
              campaignId={campaignId} 
              onComplete={handleProgressComplete}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (status === 'completed') {
    return null;
  }

  const isFailed = status === 'failed';

  return (
    <>
      <Button 
        onClick={() => handleSend(isFailed)} 
        disabled={loading}
        size="sm"
        variant={isFailed ? "outline" : "default"}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isFailed ? "Reenviando..." : "Iniciando..."}
          </>
        ) : isFailed ? (
          <>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reenviar Campanha
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Enviar Campanha
          </>
        )}
      </Button>

      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{campaignName}</DialogTitle>
            <DialogDescription>
              Acompanhe o progresso do envio em tempo real
            </DialogDescription>
          </DialogHeader>
          <CampaignProgress 
            campaignId={campaignId} 
            onComplete={handleProgressComplete}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
