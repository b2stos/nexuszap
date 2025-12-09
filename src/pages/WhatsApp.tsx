import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WhatsAppConnection } from "@/components/whatsapp/WhatsAppConnection";
import { UAZAPIConfig } from "@/components/whatsapp/UAZAPIConfig";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

export default function WhatsApp() {
  const user = useProtectedUser();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Show loading while user is being fetched
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            WhatsApp Business
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Configure e conecte seu WhatsApp Business para enviar campanhas
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* UAZAPI Configuration Card */}
          <UAZAPIConfig 
            userId={user.id} 
            onConfigured={setIsConfigured}
          />

          {/* WhatsApp Connection Card - only shows when configured */}
          {isConfigured && (
            <WhatsAppConnection />
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-6 max-w-2xl">
          <h3 className="font-semibold mb-3">ℹ️ Informações Importantes</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Primeiro configure suas credenciais UAZAPI acima</li>
            <li>• Depois conecte seu WhatsApp escaneando o QR Code</li>
            <li>• Use uma conta WhatsApp Business dedicada para disparos</li>
            <li>• Mantenha o dispositivo conectado durante os disparos</li>
            <li>• Respeite os limites de envio do WhatsApp Business</li>
            <li>• Envie apenas para contatos que autorizaram receber mensagens</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}