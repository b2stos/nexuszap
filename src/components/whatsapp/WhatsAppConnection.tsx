import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle, QrCode as QrCodeIcon } from "lucide-react";
import QRCode from "qrcode";

interface WhatsAppSession {
  status: "disconnected" | "qr" | "connected";
  qrCode?: string;
  phoneNumber?: string;
  provider?: string;
}

export function WhatsAppConnection() {
  const [session, setSession] = useState<WhatsAppSession>({ status: "disconnected" });
  const [loading, setLoading] = useState(false);
  const [qrImage, setQrImage] = useState<string>("");
  const { toast } = useToast();

  const generateQRCode = async (qrData: string) => {
    try {
      // Check if it's already a base64 image
      if (qrData.startsWith('data:image')) {
        setQrImage(qrData);
        return;
      }
      
      // Check if it's a raw base64 string (from UAZAPI)
      if (qrData.length > 100 && !qrData.includes(' ')) {
        // It might be a raw base64 image without the data URL prefix
        if (!qrData.startsWith('data:')) {
          setQrImage(`data:image/png;base64,${qrData}`);
          return;
        }
      }
      
      // Generate QR code from text
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
      setQrImage(qrDataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };

  const testCredentials = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "test" },
      });

      if (error) {
        console.error('Test error:', error);
        return { success: false, error: 'Erro ao testar credenciais' };
      }

      if (data.status === 'error') {
        return { success: false, error: data.error, details: data.details };
      }

      return { success: data.success !== false };
    } catch (error: unknown) {
      console.error('Test exception:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  };

  const initializeSession = async () => {
    setLoading(true);
    try {
      toast({
        title: "Verificando credenciais",
        description: "Testando conexão com UAZAPI...",
      });

      const testResult = await testCredentials();
      
      if (!testResult.success) {
        throw new Error(testResult.error || "Credenciais inválidas");
      }

      toast({
        title: "✓ Credenciais válidas",
        description: "Gerando QR Code...",
      });

      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "initialize" },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.error) {
        console.error('API error:', data);
        throw new Error(data.error + (data.details ? ` - ${data.details}` : ''));
      }

      if (data.status === "qr" && data.qrCode) {
        setSession(data);
        await generateQRCode(data.qrCode);
        toast({
          title: "QR Code gerado",
          description: "Escaneie o código com seu WhatsApp Business",
        });
      } else if (data.status === "connected") {
        setSession(data);
        toast({
          title: "Conectado",
          description: `WhatsApp conectado: ${data.phoneNumber || 'Número não identificado'}`,
        });
      } else if (data.status === "error") {
        throw new Error(data.error || "Erro desconhecido ao conectar");
      } else if (data.status === "disconnected") {
        throw new Error("Não foi possível gerar o QR Code. Verifique se a instância UAZAPI está ativa.");
      } else {
        throw new Error(`Status inesperado: ${data.status}`);
      }
    } catch (error: unknown) {
      console.error('Initialize error:', error);
      toast({
        title: "Erro ao inicializar",
        description: error instanceof Error ? error.message : "Verifique suas credenciais UAZAPI nos Secrets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "status" },
      });

      if (error) throw error;

      setSession(data);
      
      if (data.status === "qr" && data.qrCode) {
        await generateQRCode(data.qrCode);
      } else if (data.status === "connected") {
        toast({
          title: "Conectado!",
          description: `WhatsApp conectado: ${data.phoneNumber || 'Número não identificado'}`,
        });
      }
    } catch (error: unknown) {
      console.error("Error checking status:", error);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "disconnect" },
      });

      if (error) throw error;

      setSession({ status: "disconnected" });
      setQrImage("");
      toast({
        title: "Desconectado",
        description: "WhatsApp Business desconectado com sucesso",
      });
    } catch (error: unknown) {
      toast({
        title: "Erro ao desconectar",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    let interval: NodeJS.Timeout;
    if (session.status === "qr") {
      interval = setInterval(checkStatus, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.status]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCodeIcon className="h-5 w-5" />
              Conexão WhatsApp Business
            </CardTitle>
            <CardDescription>
              {session.provider 
                ? `Conectado via ${session.provider}` 
                : "Conecte seu WhatsApp Business para enviar campanhas"}
            </CardDescription>
          </div>
          <Badge
            variant={
              session.status === "connected"
                ? "default"
                : session.status === "qr"
                ? "secondary"
                : "outline"
            }
          >
            {session.status === "connected" && <CheckCircle className="h-3 w-3 mr-1" />}
            {session.status === "connected"
              ? "Conectado"
              : session.status === "qr"
              ? "Aguardando scan"
              : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {session.status === "disconnected" && (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte seu WhatsApp Business para começar a enviar mensagens em massa
            </p>
            <Button onClick={initializeSession} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inicializando...
                </>
              ) : (
                "Gerar QR Code"
              )}
            </Button>
          </div>
        )}

        {session.status === "qr" && qrImage && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg border-2 border-primary">
                <img src={qrImage} alt="QR Code WhatsApp" className="w-64 h-64" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Como conectar:</p>
              <ol className="text-sm text-muted-foreground text-left space-y-1 max-w-md mx-auto">
                <li>1. Abra o WhatsApp Business no seu celular</li>
                <li>2. Toque em Mais opções → Dispositivos conectados</li>
                <li>3. Toque em Conectar um dispositivo</li>
                <li>4. Escaneie este código QR</li>
              </ol>
            </div>
            <Button variant="outline" size="sm" onClick={checkStatus}>
              <RefreshCw className="mr-2 h-3 w-3" />
              Verificar conexão
            </Button>
          </div>
        )}

        {session.status === "connected" && (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="font-medium">WhatsApp Business Conectado</p>
              {session.phoneNumber && (
                <p className="text-sm text-muted-foreground">Número: {session.phoneNumber}</p>
              )}
            </div>
            <Button variant="destructive" onClick={disconnect} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                "Desconectar WhatsApp"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
