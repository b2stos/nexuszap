/**
 * ChannelBlockedAlert Component
 * 
 * Exibe um alerta crítico quando o canal está bloqueado pelo provedor
 * (ex: erro 131042 - problema de pagamento na conta Meta Business).
 * 
 * Este componente deve ser exibido na criação de campanha e no inbox
 * para impedir envios enquanto o problema não for resolvido.
 */

import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Channel } from '@/hooks/useChannels';

interface ChannelBlockedAlertProps {
  channel: Channel | null | undefined;
  onUnblock?: () => void;
  showUnblockButton?: boolean;
}

export function ChannelBlockedAlert({ 
  channel, 
  onUnblock,
  showUnblockButton = false 
}: ChannelBlockedAlertProps) {
  if (!channel?.blocked_by_provider) return null;

  const isPaymentError = channel.blocked_error_code === '131042' || 
    channel.blocked_reason?.toLowerCase().includes('payment') ||
    channel.blocked_reason?.toLowerCase().includes('eligibility');

  return (
    <Alert variant="destructive" className="border-2 border-destructive/50">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-bold">
        {isPaymentError ? '🚫 Canal Bloqueado - Problema de Pagamento' : '🚫 Canal Bloqueado pelo Provedor'}
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-3">
        <p className="text-sm">
          {isPaymentError ? (
            <>
              A Meta retornou erro <strong>{channel.blocked_error_code || '131042'}</strong> (Business eligibility payment issue).
              <br />
              <strong>As mensagens NÃO estão sendo entregues</strong> enquanto o problema de pagamento não for resolvido.
            </>
          ) : (
            <>
              O provedor bloqueou este canal com erro <strong>{channel.blocked_error_code}</strong>.
              <br />
              {channel.blocked_reason && <span className="text-muted-foreground">{channel.blocked_reason}</span>}
            </>
          )}
        </p>

        {isPaymentError && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => window.open('https://business.facebook.com/billing_hub/payment_settings', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Corrigir Pagamento na Meta
            </Button>
            
            {showUnblockButton && onUnblock && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUnblock}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Desbloquear
              </Button>
            )}
          </div>
        )}

        {channel.blocked_at && (
          <p className="text-xs text-muted-foreground pt-2">
            Bloqueado em: {new Date(channel.blocked_at).toLocaleString('pt-BR')}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook helper para verificar se o canal está bloqueado
 */
export function isChannelBlocked(channel: Channel | null | undefined): boolean {
  return !!channel?.blocked_by_provider;
}

/**
 * Verifica se é erro de pagamento específico
 */
export function isChannelBlockedByPayment(channel: Channel | null | undefined): boolean {
  if (!channel?.blocked_by_provider) return false;
  
  return channel.blocked_error_code === '131042' || 
    channel.blocked_reason?.toLowerCase().includes('payment') ||
    channel.blocked_reason?.toLowerCase().includes('eligibility') ||
    false;
}
