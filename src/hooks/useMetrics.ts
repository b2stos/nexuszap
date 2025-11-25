import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "@/utils/constants";

interface Metrics {
  totalCampaigns: number;
  totalContacts: number;
  totalMessages: number;
  deliveryRate: number;
  readRate: number;
}

export const useMetrics = () => {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.METRICS],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const [campaignsRes, contactsRes, messagesRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id", { count: "exact" })
          .eq("user_id", user.id),
        supabase
          .from("contacts")
          .select("id", { count: "exact" })
          .eq("user_id", user.id),
        supabase
          .from("messages")
          .select("status", { count: "exact" })
          .in("campaign_id", 
            (await supabase
              .from("campaigns")
              .select("id")
              .eq("user_id", user.id)
            ).data?.map(c => c.id) || []
          ),
      ]);

      const totalCampaigns = campaignsRes.count || 0;
      const totalContacts = contactsRes.count || 0;
      const totalMessages = messagesRes.count || 0;

      const deliveredMessages = messagesRes.data?.filter(
        m => m.status === "delivered" || m.status === "read"
      ).length || 0;

      const readMessages = messagesRes.data?.filter(
        m => m.status === "read"
      ).length || 0;

      const deliveryRate = totalMessages > 0 
        ? (deliveredMessages / totalMessages) * 100 
        : 0;

      const readRate = deliveredMessages > 0 
        ? (readMessages / deliveredMessages) * 100 
        : 0;

      return {
        totalCampaigns,
        totalContacts,
        totalMessages,
        deliveryRate,
        readRate,
      } as Metrics;
    },
  });

  return {
    metrics,
    isLoading,
    error,
  };
};
