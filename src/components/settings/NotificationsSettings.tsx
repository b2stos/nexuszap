import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { UserSettings } from '@/hooks/useUserSettings';

interface NotificationsSettingsProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  isSaving: boolean;
}

const notificationOptions = [
  {
    id: 'notify_campaign_complete' as const,
    label: 'Campanha Finalizada',
    description: 'Receba um aviso quando uma campanha terminar de enviar',
    icon: CheckCircle2,
  },
  {
    id: 'notify_send_failure' as const,
    label: 'Falha de Envio',
    description: 'Alerta quando mensagens falharem durante o disparo',
    icon: AlertTriangle,
  },
  {
    id: 'notify_new_message' as const,
    label: 'Nova Mensagem',
    description: 'Notificação ao receber mensagens no Inbox',
    icon: MessageSquare,
  },
];

export function NotificationsSettings({ settings, onUpdate, isSaving }: NotificationsSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Notificações</h3>
        <p className="text-sm text-muted-foreground">
          Configure quais alertas você deseja receber
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </CardTitle>
          <CardDescription>
            Escolha quais eventos geram notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationOptions.map((option) => {
            const Icon = option.icon;
            const isEnabled = settings[option.id];
            
            return (
              <div
                key={option.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Label htmlFor={option.id} className="font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={option.id}
                  checked={isEnabled}
                  onCheckedChange={(checked) => onUpdate({ [option.id]: checked })}
                  disabled={isSaving}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canais de Notificação</CardTitle>
          <CardDescription>
            Em breve: notificações por email, push e Telegram
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted/50 border border-dashed text-center text-sm text-muted-foreground">
            Configuração de canais de notificação em desenvolvimento
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
