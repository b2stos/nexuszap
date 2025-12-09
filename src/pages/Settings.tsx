import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { WebhookDiagnostics } from "@/components/dashboard/WebhookDiagnostics";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Settings as SettingsIcon,
  User,
  Calendar,
  Mail,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ApiStatus = "loading" | "connected" | "disconnected" | "error";

export default function Settings() {
  const user = useProtectedUser();
  const [apiStatus, setApiStatus] = useState<ApiStatus>("loading");
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkApiStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session", {
        body: { action: "status" },
      });

      if (error) {
        console.error("Error checking API status:", error);
        setApiStatus("error");
        return;
      }

      if (data?.connected === true || data?.status === "connected") {
        setApiStatus("connected");
      } else {
        setApiStatus("disconnected");
      }
    } catch (err) {
      console.error("Failed to check API status:", err);
      setApiStatus("error");
    } finally {
      setChecking(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkApiStatus();
  }, []);

  const getStatusBadge = () => {
    switch (apiStatus) {
      case "loading":
        return <Badge variant="secondary">Verificando...</Badge>;
      case "connected":
        return <Badge className="bg-green-500 hover:bg-green-600">Conectado</Badge>;
      case "disconnected":
        return <Badge variant="destructive">Desconectado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const getStatusIcon = () => {
    switch (apiStatus) {
      case "loading":
        return <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />;
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "disconnected":
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  if (!user) {
    return (
      <DashboardLayout user={null}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Configurações
          </h2>
          <p className="text-muted-foreground mt-2">
            Gerencie as configurações da sua conta e status da API
          </p>
        </div>

        {/* API Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Status da API WhatsApp</span>
              {getStatusBadge()}
            </CardTitle>
            <CardDescription>
              Verifique o status da conexão com a API do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
              {getStatusIcon()}
              <div className="flex-1">
                <p className="font-medium">
                  {apiStatus === "connected" && "API conectada e funcionando"}
                  {apiStatus === "disconnected" && "API desconectada"}
                  {apiStatus === "error" && "Erro ao verificar status"}
                  {apiStatus === "loading" && "Verificando conexão..."}
                </p>
                {lastChecked && (
                  <p className="text-sm text-muted-foreground">
                    Última verificação: {format(lastChecked, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkApiStatus}
                disabled={checking}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                Verificar
              </Button>
            </div>

            {(apiStatus === "disconnected" || apiStatus === "error") && (
              <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Ação necessária</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {apiStatus === "error" 
                        ? "Verifique se os secrets da UAZAPI estão configurados corretamente (UAZAPI_BASE_URL e UAZAPI_INSTANCE_TOKEN)."
                        : "Conecte seu WhatsApp escaneando o QR Code na página de conexão."}
                    </p>
                    <Button asChild variant="default" size="sm" className="mt-3">
                      <a href="/dashboard/whatsapp">
                        Ir para Conexão WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Diagnostics Card */}
        <WebhookDiagnostics />

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações da Conta
            </CardTitle>
            <CardDescription>
              Detalhes sobre sua conta de usuário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Membro desde</p>
                  <p className="font-medium">
                    {user.created_at 
                      ? format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting Card */}
        <Card>
          <CardHeader>
            <CardTitle>Solução de Problemas</CardTitle>
            <CardDescription>
              Verifique esses itens se estiver tendo problemas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">1.</span>
                <span>Verifique se o WhatsApp está conectado (QR Code escaneado)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">2.</span>
                <span>Confirme que os secrets UAZAPI estão configurados corretamente (UAZAPI_BASE_URL e UAZAPI_INSTANCE_TOKEN)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">3.</span>
                <span>Verifique se sua instância UAZAPI está ativa</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">4.</span>
                <span>Certifique-se de que o número de telefone está no formato correto (com DDI)</span>
              </li>
            </ul>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Precisa de ajuda adicional?
              </p>
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://base360.uazapi.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Painel UAZAPI
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
