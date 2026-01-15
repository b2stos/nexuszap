/**
 * MetaAccountInfo Component
 * 
 * Exibe IDs da conta Meta (WABA ID, Phone Number ID) com botões de copiar
 */

import { Copy, ExternalLink, Settings, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface MetaAccountInfoProps {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessId?: string | null;
  channelId?: string;
  channelName?: string;
}

export function MetaAccountInfo({
  wabaId,
  phoneNumberId,
  businessId,
  channelId,
  channelName,
}: MetaAccountInfoProps) {
  const navigate = useNavigate();

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const hasAnyConfig = wabaId || phoneNumberId || businessId;

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.546 20.2A1.884 1.884 0 0 0 4.8 21.454l3.032-.892A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
              </svg>
              Informações da Conta Meta
            </CardTitle>
            <CardDescription className="text-sm">
              {channelName ? `Canal: ${channelName}` : 'IDs da conta WhatsApp Business'}
            </CardDescription>
          </div>
          {hasAnyConfig && (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasAnyConfig ? (
          <>
            {/* WABA ID */}
            <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WABA ID</p>
                <p className="font-mono text-sm truncate">{wabaId || 'Não configurado'}</p>
              </div>
              {wabaId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(wabaId, 'WABA ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Phone Number ID */}
            <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Phone Number ID (Cloud API)</p>
                <p className="font-mono text-sm truncate">{phoneNumberId || 'Não configurado'}</p>
              </div>
              {phoneNumberId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(phoneNumberId, 'Phone Number ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Business ID (optional) */}
            {businessId && (
              <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Business ID</p>
                  <p className="font-mono text-sm truncate">{businessId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(businessId, 'Business ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Link to Meta Business */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-blue-600 hover:text-blue-700"
                onClick={() => window.open('https://business.facebook.com/wa/manage/message-templates/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Gerenciar Templates no Meta Business Suite
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Nenhum ID Meta configurado para este canal.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/dashboard/channels')}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Configurar no Canal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MetaAccountInfo;
