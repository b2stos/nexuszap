import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { RecentCampaigns } from "@/components/dashboard/RecentCampaigns";
import { WebhookMonitor } from "@/components/dashboard/WebhookMonitor";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
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
      <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dashboard
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Visão geral das suas campanhas e métricas
            </p>
          </div>
        </div>
        
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks (Tempo Real)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <MetricsCards />
            <RecentCampaigns />
          </TabsContent>
          
          <TabsContent value="webhooks">
            <WebhookMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
