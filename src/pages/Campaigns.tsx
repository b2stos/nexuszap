import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CampaignsHeader } from "@/components/campaigns/CampaignsHeader";
import { CampaignsGrid } from "@/components/campaigns/CampaignsGrid";
import { Loader2 } from "lucide-react";

export default function Campaigns() {
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
      <div className="space-y-8">
        <CampaignsHeader />
        <CampaignsGrid />
      </div>
    </DashboardLayout>
  );
}
