import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  BarChart3, 
  Radio, 
  Megaphone,
  GripVertical
} from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface DashboardSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  isSaving: boolean;
}

const availableWidgets = [
  { 
    id: 'onboarding', 
    label: 'Onboarding', 
    description: 'Checklist de primeiros passos', 
    icon: CheckCircle2 
  },
  { 
    id: 'metrics', 
    label: 'Métricas', 
    description: 'Cards com estatísticas principais', 
    icon: BarChart3 
  },
  { 
    id: 'webhooks', 
    label: 'Monitor Webhook', 
    description: 'Status de eventos em tempo real', 
    icon: Radio 
  },
  { 
    id: 'campaigns', 
    label: 'Campanhas Recentes', 
    description: 'Últimas campanhas enviadas', 
    icon: Megaphone 
  },
];

export function DashboardSettings({ settings, onUpdate, isSaving }: DashboardSettingsProps) {
  const toggleWidget = (widgetId: string) => {
    const currentWidgets = settings.dashboard_widgets || [];
    const isEnabled = currentWidgets.includes(widgetId);
    
    const newWidgets = isEnabled
      ? currentWidgets.filter(id => id !== widgetId)
      : [...currentWidgets, widgetId];
    
    onUpdate({ dashboard_widgets: newWidgets });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Dashboard</h3>
        <p className="text-sm text-muted-foreground">
          Escolha quais widgets aparecem no seu dashboard
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Widgets Visíveis</CardTitle>
          <CardDescription>
            Ative ou desative os widgets que deseja ver na página inicial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableWidgets.map((widget) => {
            const Icon = widget.icon;
            const isEnabled = (settings.dashboard_widgets || []).includes(widget.id);
            
            return (
              <div
                key={widget.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Label htmlFor={widget.id} className="font-medium cursor-pointer">
                      {widget.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {widget.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={widget.id}
                  checked={isEnabled}
                  onCheckedChange={() => toggleWidget(widget.id)}
                  disabled={isSaving}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            Ordenação
          </CardTitle>
          <CardDescription>
            Em breve você poderá arrastar para reorganizar os widgets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/50 border border-dashed text-center text-sm text-muted-foreground">
            Funcionalidade de arrastar e soltar em desenvolvimento
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
