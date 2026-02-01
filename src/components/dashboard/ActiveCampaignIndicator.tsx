/**
 * ActiveCampaignIndicator - Mini-painel de progresso de campanhas ativas
 */

import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Send, AlertCircle, Loader2 } from "lucide-react";
import { ActiveCampaign } from "@/contexts/CampaignBackgroundContext";

interface Props {
  campaigns: ActiveCampaign[];
  onClose?: () => void;
}

export function ActiveCampaignIndicator({ campaigns, onClose }: Props) {
  if (campaigns.length === 0) return null;

  return (
    <div className="mx-2 mb-4 p-3 rounded-lg bg-muted/50 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Campanhas Ativas
        </span>
        <Badge variant="secondary" className="text-xs">
          {campaigns.length}
        </Badge>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate flex-1">
                {campaign.name}
              </span>
              {campaign.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
              )}
            </div>

            <Progress value={campaign.progress} className="h-1.5" />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Send className="h-3 w-3" />
                <span>
                  {campaign.sent}/{campaign.total}
                </span>
                {campaign.failed > 0 && (
                  <span className="text-destructive">
                    ({campaign.failed} falhas)
                  </span>
                )}
              </div>
              <span>{Math.round(campaign.progress)}%</span>
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={onClose}
            >
              <Link to={`/dashboard/campaigns/${campaign.id}`}>
                <Eye className="h-3 w-3 mr-1" />
                Ver Detalhes
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
