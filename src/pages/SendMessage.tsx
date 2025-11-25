import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MessageForm } from "@/components/MessageForm";
import { Loader2 } from "lucide-react";

export default function SendMessage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error checking session:', error);
          setLoading(false);
          navigate("/auth");
          return;
        }
        if (!session) {
          navigate("/auth");
          return;
        }
        setUser(session.user);
        setLoading(false);
      } catch (error) {
        console.error('Failed to check user session:', error);
        setLoading(false);
        navigate("/auth");
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        setLoading(false);
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
