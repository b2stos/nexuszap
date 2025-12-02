import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MessageForm } from "@/components/MessageForm";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";

export default function SendMessage() {
  const user = useProtectedUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Enviar Mensagem
          </h2>
          <p className="text-muted-foreground mt-2">
            Envie mensagens individuais via WhatsApp para seus contatos
          </p>
        </div>
        
        <MessageForm />
      </div>
    </DashboardLayout>
  );
}
