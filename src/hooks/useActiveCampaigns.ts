/**
 * useActiveCampaigns - Hook para acessar campanhas ativas do contexto global
 */

import { useCampaignBackground } from "@/contexts/CampaignBackgroundContext";

export function useActiveCampaigns() {
  const { activeCampaigns, isProcessing, processingCampaignId } = useCampaignBackground();

  const runningCampaigns = activeCampaigns.filter((c) => c.status === "running");
  const pausedCampaigns = activeCampaigns.filter((c) => c.status === "paused");

  return {
    activeCampaigns,
    runningCampaigns,
    pausedCampaigns,
    hasActiveCampaigns: activeCampaigns.length > 0,
    hasRunningCampaigns: runningCampaigns.length > 0,
    isProcessing,
    processingCampaignId,
  };
}
