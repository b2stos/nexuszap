import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WhatsAppConnection } from "@/components/whatsapp/WhatsAppConnection";
import { Loader2 } from "lucide-react";

export default function WhatsApp() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
            Conecte seu WhatsApp Business para enviar campanhas
          </p>
        </div>

        <div className="max-w-2xl">
          <WhatsAppConnection />
        </div>

        <div className="bg-muted/50 rounded-lg p-6 max-w-2xl">
          <h3 className="font-semibold mb-3">ℹ️ Informações Importantes</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
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
