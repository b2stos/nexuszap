import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "user";

interface UseUserRoleReturn {
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user || !mounted) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (mounted) {
        if (error) {
          console.error("Error fetching user role:", error);
          setRole("user");
        } else {
          setRole(data?.role as AppRole || "user");
        }
        setLoading(false);
      }
    }

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setRole(null);
          setLoading(false);
        } else {
          fetchRole();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    loading,
  };
}
