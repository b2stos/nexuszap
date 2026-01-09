import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorSection } from "@/components/ErrorSection";
import { 
  Settings as SettingsIcon,
  User,
  Calendar,
  Mail,
  Shield,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Settings() {
  const user = useProtectedUser();

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  // Show loading state while waiting for user
  if (!user) {
    return (
      <DashboardLayout user={null}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            Gerencie as configurações da sua conta
          </p>
        </div>

        {/* API Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                WhatsApp API Oficial
              </span>
              <Badge className="bg-green-500 hover:bg-green-600">API Oficial</Badge>
            </CardTitle>
            <CardDescription>
              Sua conta utiliza a API Oficial do WhatsApp via BSP homologado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Conexão segura via API Oficial Meta
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                ✓ Sem risco de bloqueio de número
              </p>
              <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                ✓ Templates aprovados pela Meta
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure seus canais de WhatsApp na seção <strong>Canais</strong> do menu lateral.
            </p>
          </CardContent>
        </Card>

        {/* User Info Card */}
        <ErrorSection 
          fallbackTitle="Erro ao carregar informações"
          fallbackDescription="Não foi possível carregar as informações da conta."
        >
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
                    <p className="font-medium">{user?.email || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Membro desde</p>
                    <p className="font-medium">
                      {formatDate(user?.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </ErrorSection>

        {/* Help Card */}
        <Card>
          <CardHeader>
            <CardTitle>Precisa de ajuda?</CardTitle>
            <CardDescription>
              Recursos para aproveitar ao máximo a plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">1.</span>
                <span>Configure seu canal de WhatsApp na seção <strong>Canais</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">2.</span>
                <span>Crie templates aprovados na seção <strong>Templates</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">3.</span>
                <span>Importe seus contatos na seção <strong>Contatos</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium text-primary">4.</span>
                <span>Crie e envie campanhas ou atenda clientes no <strong>Inbox</strong></span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}