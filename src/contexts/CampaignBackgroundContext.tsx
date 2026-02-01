/**
 * CampaignBackgroundContext
 * 
 * Provider global que processa campanhas em background,
 * independente da página atual do usuário.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveCampaign {
  id: string;
  name: string;
  status: "running" | "paused";
  progress: number;
  sent: number;
  total: number;
  failed: number;
}

interface CampaignBackgroundContextValue {
  activeCampaigns: ActiveCampaign[];
  isProcessing: boolean;
  processingCampaignId: string | null;
}

const CampaignBackgroundContext = createContext<CampaignBackgroundContextValue>({
  activeCampaigns: [],
  isProcessing: false,
  processingCampaignId: null,
});

export function useCampaignBackground() {
  return useContext(CampaignBackgroundContext);
}

interface Props {
  children: ReactNode;
}

export function CampaignBackgroundProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const [processingCampaignId, setProcessingCampaignId] = useState<string | null>(null);
  const processingRef = useRef<Set<string>>(new Set());
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get current user's tenant
  useEffect(() => {
    async function fetchTenant() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenantId(null);
        return;
      }

      const { data } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      setTenantId(data?.tenant_id || null);
    }

    fetchTenant();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchTenant();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Query running/paused campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["background-campaigns", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("mt_campaigns")
        .select("id, name, status, total_recipients, sent_count, failed_count")
        .eq("tenant_id", tenantId)
        .in("status", ["running", "paused"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 5000, // Poll every 5s
  });

  // Transform to active campaigns format
  const activeCampaigns: ActiveCampaign[] = (campaigns || []).map((c) => {
    const total = c.total_recipients || 0;
    const sent = c.sent_count || 0;
    const failed = c.failed_count || 0;
    const processed = sent + failed;
    const progress = total > 0 ? (processed / total) * 100 : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status as "running" | "paused",
      progress,
      sent,
      total,
      failed,
    };
  });

  // Get only running campaigns
  const runningCampaigns = activeCampaigns.filter((c) => c.status === "running");

  // Process batch function
  const processBatch = useCallback(async (campaignId: string) => {
    // Prevent duplicate processing
    if (processingRef.current.has(campaignId)) {
      return;
    }

    processingRef.current.add(campaignId);
    setProcessingCampaignId(campaignId);

    try {
      const { data, error } = await supabase.functions.invoke("campaign-process-queue", {
        body: { campaign_id: campaignId, speed: "normal" },
      });

      if (error) {
        console.error("[CampaignBackground] Process batch error:", error);
      }

      // Check if campaign is done
      const response = data as { noop?: boolean; remaining?: number } | null;
      if (response?.noop || response?.remaining === 0) {
        // Campaign finished, refresh queries
        queryClient.invalidateQueries({ queryKey: ["background-campaigns", tenantId] });
        queryClient.invalidateQueries({ queryKey: ["mt-campaigns", tenantId] });
      }
    } catch (err) {
      console.error("[CampaignBackground] Process batch exception:", err);
    } finally {
      processingRef.current.delete(campaignId);
      setProcessingCampaignId(null);
    }
  }, [queryClient, tenantId]);

  // Auto-trigger batch processing for running campaigns
  useEffect(() => {
    if (runningCampaigns.length === 0) return;

    const interval = setInterval(() => {
      runningCampaigns.forEach((campaign) => {
        // Only process if not already processing and has items to send
        if (!processingRef.current.has(campaign.id) && campaign.sent + campaign.failed < campaign.total) {
          console.log("[CampaignBackground] Auto-triggering batch for:", campaign.id);
          processBatch(campaign.id);
        }
      });
    }, 5000); // Process every 5 seconds

    return () => clearInterval(interval);
  }, [runningCampaigns, processBatch]);

  const value: CampaignBackgroundContextValue = {
    activeCampaigns,
    isProcessing: processingCampaignId !== null,
    processingCampaignId,
  };

  return (
    <CampaignBackgroundContext.Provider value={value}>
      {children}
    </CampaignBackgroundContext.Provider>
  );
}
