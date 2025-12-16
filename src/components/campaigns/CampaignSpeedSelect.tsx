import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Gauge, Snail, Settings2, Loader2 } from "lucide-react";

type SendSpeed = 'slow' | 'normal' | 'fast';

interface CampaignSpeedSelectProps {
  campaignId: string;
  currentSpeed: SendSpeed;
  onSpeedChange?: () => void;
  disabled?: boolean;
}

const speedLabels: Record<SendSpeed, string> = {
  slow: "Lento",
  normal: "Normal",
  fast: "Rápido",
};

const speedIcons: Record<SendSpeed, React.ReactNode> = {
  slow: <Snail className="h-3 w-3 text-green-500" />,
  normal: <Gauge className="h-3 w-3 text-blue-500" />,
  fast: <Zap className="h-3 w-3 text-yellow-500" />,
};

export function CampaignSpeedSelect({ 
  campaignId, 
  currentSpeed, 
  onSpeedChange,
  disabled = false 
}: CampaignSpeedSelectProps) {
  const [speed, setSpeed] = useState<SendSpeed>(currentSpeed || 'normal');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    if (speed === currentSpeed) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ send_speed: speed })
        .eq("id", campaignId);

      if (error) throw error;

      toast.success(`Velocidade alterada para ${speedLabels[speed]}`);
      onSpeedChange?.();
      setOpen(false);
    } catch (error: any) {
      console.error("Error updating speed:", error);
      toast.error("Erro ao alterar velocidade");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 gap-1"
          disabled={disabled}
        >
          {speedIcons[currentSpeed || 'normal']}
          <span className="text-xs">{speedLabels[currentSpeed || 'normal']}</span>
          <Settings2 className="h-3 w-3 ml-1 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Velocidade de Envio</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Escolha a velocidade antes de enviar
            </p>
          </div>
          
          <RadioGroup
            value={speed}
            onValueChange={(value) => setSpeed(value as SendSpeed)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="slow" id={`speed-slow-${campaignId}`} />
              <Label 
                htmlFor={`speed-slow-${campaignId}`} 
                className="flex items-center gap-2 cursor-pointer"
              >
                <Snail className="h-4 w-4 text-green-500" />
                <div>
                  <span className="text-sm">Lento</span>
                  <span className="text-xs text-muted-foreground ml-2">~3s/msg</span>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="normal" id={`speed-normal-${campaignId}`} />
              <Label 
                htmlFor={`speed-normal-${campaignId}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Gauge className="h-4 w-4 text-blue-500" />
                <div>
                  <span className="text-sm">Normal</span>
                  <span className="text-xs text-muted-foreground ml-2">~1.5s/msg</span>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fast" id={`speed-fast-${campaignId}`} />
              <Label 
                htmlFor={`speed-fast-${campaignId}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Zap className="h-4 w-4 text-yellow-500" />
                <div>
                  <span className="text-sm">Rápido</span>
                  <span className="text-xs text-muted-foreground ml-2">~0.8s/msg</span>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <Button 
            size="sm" 
            className="w-full" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Salvando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}