import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, RotateCcw } from "lucide-react";

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

  const handleSend = async (resend: boolean = false) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-messages", {
        body: { 
          campaignId,
          resend,
          instanceName: "whatsapp-business"
        },
      });

      if (error) throw error;

      const action = resend ? "reenviada" : "enviada";
      toast({
        title: `Campanha ${action}!`,
        description: `${data.sent} mensagens enviadas com sucesso${data.failed > 0 ? `, ${data.failed} falharam` : ''}.`,
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

  if (status === 'sending' || status === 'completed') {
    return null;
  }

  const isFailed = status === 'failed';

  return (
    <Button 
      onClick={() => handleSend(isFailed)} 
      disabled={loading}
      size="sm"
      variant={isFailed ? "outline" : "default"}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {isFailed ? "Reenviando..." : "Enviando..."}
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
  );
}
