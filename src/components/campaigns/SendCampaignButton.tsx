import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";

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

  const handleSend = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-messages", {
        body: { 
          campaignId,
          instanceName: "whatsapp-business"
        },
      });

      if (error) throw error;

      toast({
        title: "Campanha enviada!",
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

  if (status !== 'draft' && status !== 'failed') {
    return null;
  }

  return (
    <Button 
      onClick={handleSend} 
      disabled={loading}
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Enviando...
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
