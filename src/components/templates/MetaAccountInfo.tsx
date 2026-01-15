/**
 * MetaAccountInfo Component
 * 
 * Exibe IDs da conta Meta (WABA ID, Phone Number ID) com botões de copiar
 * Busca automaticamente o Phone Number ID via edge function
 */

import { useState, useEffect } from 'react';
import { Copy, Settings, CheckCircle, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface MetaAccountInfoProps {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  businessId?: string | null;
  channelId?: string;
  channelName?: string;
}

interface MetaIdentifiersResult {
  success: boolean;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  reason?: string;
  cached?: boolean;
  error?: string;
}

// Map reason codes to user-friendly messages
const REASON_MESSAGES: Record<string, string> = {
  'provider_does_not_expose': 'Indisponível via provedor atual (NotificaMe)',
  'token_expired_or_no_permission': 'Token expirado ou sem permissão',
  'no_phone_numbers_in_waba': 'Nenhum número encontrado nesta conta WABA',
  'meta_api_error': 'Erro na API da Meta',
  'network_error': 'Erro de conexão',
  'no_credentials_configured': 'Credenciais não configuradas',
};

export function MetaAccountInfo({
  wabaId: initialWabaId,
  phoneNumberId: initialPhoneNumberId,
  businessId,
  channelId,
  channelName,
}: MetaAccountInfoProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [wabaId, setWabaId] = useState(initialWabaId);
  const [phoneNumberId, setPhoneNumberId] = useState(initialPhoneNumberId);
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  // Fetch meta identifiers when channelId is available and phone_number_id is missing
  useEffect(() => {
    if (channelId && initialWabaId && !initialPhoneNumberId) {
      fetchMetaIdentifiers();
    }
  }, [channelId, initialWabaId, initialPhoneNumberId]);

  const fetchMetaIdentifiers = async () => {
    if (!channelId) return;

    setIsLoading(true);
    setUnavailableReason(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-meta-identifiers', {
        body: { channel_id: channelId },
      });

      if (error) {
        console.error('Error fetching meta identifiers:', error);
        setUnavailableReason('Erro ao buscar identificadores');
        return;
      }

      const result = data as MetaIdentifiersResult;

      if (result.success) {
        setWabaId(result.waba_id || wabaId);
        setPhoneNumberId(result.phone_number_id);
        setDisplayPhoneNumber(result.display_phone_number);

        if (!result.phone_number_id && result.reason) {
          setUnavailableReason(REASON_MESSAGES[result.reason] || result.reason);
        }
      } else {
        setUnavailableReason(result.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Error calling fetch-meta-identifiers:', err);
      setUnavailableReason('Erro de conexão');
    } finally {
      setIsLoading(false);
    }
  };

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
          {hasAnyConfig && !isLoading && (
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasAnyConfig || isLoading ? (
          <>
            {/* WABA ID */}
            <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WABA ID</p>
                {isLoading && !wabaId ? (
                  <Skeleton className="h-5 w-32 mt-1" />
                ) : (
                  <p className="font-mono text-sm truncate">{wabaId || 'Não configurado'}</p>
                )}
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

            {/* Phone Number ID - Only show for Meta Cloud API when value exists */}
            {phoneNumberId && (
              <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Phone Number ID (Cloud API)</p>
                  <p className="font-mono text-sm truncate">{phoneNumberId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(phoneNumberId, 'Phone Number ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Display Phone Number (if available) */}
            {displayPhoneNumber && (
              <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Número do WhatsApp</p>
                  <p className="font-mono text-sm truncate">{displayPhoneNumber}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(displayPhoneNumber, 'Número')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

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
