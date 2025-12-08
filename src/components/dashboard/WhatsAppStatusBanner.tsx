import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ConnectionStatus = "loading" | "connected" | "disconnected" | "error";

export function WhatsAppStatusBanner() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "status" },
      });

      if (error) {
        console.error("Error checking WhatsApp status:", error);
        setStatus("error");
        return;
      }

      // Check if connected based on UAZAPI response
      if (data?.status === "connected") {
        setStatus("connected");
      } else {
        setStatus("disconnected");
      }
    } catch (err) {
      console.error("Failed to check WhatsApp status:", err);
      setStatus("error");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Don't show banner if connected or loading
  if (status === "connected" || status === "loading") {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>WhatsApp Desconectado</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
        <span>
          {status === "error" 
            ? "Não foi possível verificar o status. Verifique as configurações UAZAPI."
            : "Você precisa conectar o WhatsApp para enviar mensagens."}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${checking ? "animate-spin" : ""}`} />
            Verificar
          </Button>
          <Button asChild size="sm">
            <Link to="/dashboard/whatsapp">
              <QrCode className="h-4 w-4 mr-1" />
              Conectar
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
