import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ValidationDemo } from "@/components/ValidationDemo";
import { Loader2 } from "lucide-react";

export default function ValidationTest() {
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
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Teste de Validações
          </h2>
          <p className="text-muted-foreground mt-2">
            Teste todas as validações implementadas no sistema
          </p>
        </div>
        
        <ValidationDemo />
      </div>
    </DashboardLayout>
  );
}
