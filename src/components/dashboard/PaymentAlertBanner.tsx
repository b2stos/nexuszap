/**
 * PaymentAlertBanner Component
 * 
 * Exibe um alerta global no Dashboard quando é detectado
 * erro 131042 (Meta Business payment issue) em qualquer campanha.
 * 
 * Implementa:
 * - TTL de 30 minutos: o banner some se não houver novos erros 131042
 * - Auto-desativação: some automaticamente após um envio bem-sucedido
 */

import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

// TTL em minutos - o banner some após este tempo sem novos erros
const PAYMENT_ERROR_TTL_MINUTES = 30;

interface PaymentIssueState {
  isActive: boolean;
  lastSeenAt: Date | null;
  hasSuccessAfterError: boolean;
}

interface PaymentAlertBannerProps {
  tenantId?: string;
}

export function PaymentAlertBanner({ tenantId }: PaymentAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: paymentState } = useQuery({
    queryKey: ['payment-issue-check', tenantId],
    queryFn: async (): Promise<PaymentIssueState> => {
      const ttlCutoff = new Date();
      ttlCutoff.setMinutes(ttlCutoff.getMinutes() - PAYMENT_ERROR_TTL_MINUTES);

      // 1. Buscar o erro 131042 mais recente dentro da janela TTL
      let lastPaymentErrorAt: Date | null = null;

      // Verificar em webhooks
      const webhookQuery = supabase
        .from('mt_webhook_events')
        .select('received_at, payload_raw, provider_error_code')
        .gte('received_at', ttlCutoff.toISOString())
        .order('received_at', { ascending: false })
        .limit(100);

      if (tenantId) {
        webhookQuery.eq('tenant_id', tenantId);
      }

      const { data: webhooks } = await webhookQuery;

      if (webhooks) {
        for (const webhook of webhooks) {
          // Verificar no campo provider_error_code direto
          if (webhook.provider_error_code === '131042') {
            const errorTime = new Date(webhook.received_at);
            if (!lastPaymentErrorAt || errorTime > lastPaymentErrorAt) {
              lastPaymentErrorAt = errorTime;
            }
            continue;
          }

          // Verificar no payload_raw
          const payloadRaw = webhook.payload_raw as Record<string, unknown>;
          const body = payloadRaw?.body as Record<string, unknown>;
          const messageStatus = body?.messageStatus as Record<string, unknown>;

          if (messageStatus?.code === 'ERROR') {
            const error = messageStatus.error as Record<string, unknown>;
            if (String(error?.code) === '131042') {
              const errorTime = new Date(webhook.received_at);
              if (!lastPaymentErrorAt || errorTime > lastPaymentErrorAt) {
                lastPaymentErrorAt = errorTime;
              }
            }
          }
        }
      }

      // Verificar em campaign_recipients
      const { data: failedRecipients } = await supabase
        .from('campaign_recipients')
        .select('last_error, updated_at')
        .eq('status', 'failed')
        .gte('updated_at', ttlCutoff.toISOString())
        .order('updated_at', { ascending: false })
        .limit(50);

      if (failedRecipients) {
        for (const recipient of failedRecipients) {
          if (recipient.last_error?.includes('131042')) {
            const errorTime = new Date(recipient.updated_at);
            if (!lastPaymentErrorAt || errorTime > lastPaymentErrorAt) {
              lastPaymentErrorAt = errorTime;
            }
          }
        }
      }

      // Se não encontrou erro 131042 dentro do TTL, não está ativo
      if (!lastPaymentErrorAt) {
        return { isActive: false, lastSeenAt: null, hasSuccessAfterError: false };
      }

      // 2. Verificar se houve envio bem-sucedido APÓS o último erro 131042
      const { data: successAfterError } = await supabase
        .from('campaign_recipients')
        .select('id')
        .in('status', ['sent', 'delivered', 'read'])
        .gt('updated_at', lastPaymentErrorAt.toISOString())
        .limit(1);

      // Também verificar em mt_messages por mensagens enviadas com sucesso
      const { data: successMessages } = await supabase
        .from('mt_messages')
        .select('id')
        .eq('direction', 'outbound')
        .in('status', ['sent', 'delivered', 'read'])
        .gt('sent_at', lastPaymentErrorAt.toISOString())
        .limit(1);

      const hasSuccessAfterError = 
        (successAfterError && successAfterError.length > 0) ||
        (successMessages && successMessages.length > 0);

      // Se houve sucesso após o erro, desativar o banner
      if (hasSuccessAfterError) {
        return { 
          isActive: false, 
          lastSeenAt: lastPaymentErrorAt, 
          hasSuccessAfterError: true 
        };
      }

      // Banner ativo: erro dentro do TTL e sem sucesso posterior
      return { 
        isActive: true, 
        lastSeenAt: lastPaymentErrorAt, 
        hasSuccessAfterError: false 
      };
    },
    refetchInterval: 30000, // Verificar a cada 30 segundos para reagir mais rápido
    staleTime: 15000,
  });

  const isActive = paymentState?.isActive ?? false;

  if (!isActive || dismissed) {
    return null;
  }

  return (
    <Alert 
      variant="destructive" 
      className="relative bg-red-500/10 border-red-500/50 mb-6"
    >
      <CreditCard className="h-5 w-5" />
      <AlertTitle className="font-semibold">
        Problema de Pagamento Detectado na Meta Business
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm mb-3">
          Detectamos o erro <strong>131042</strong> nas suas campanhas recentes. 
          Isso significa que as mensagens não estão sendo entregues devido a um problema 
          de pagamento na sua conta Meta Business.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/50 hover:bg-red-500/10"
            onClick={() => window.open('https://business.facebook.com/billing_hub/accounts', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Configurar Pagamento na Meta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4 mr-2" />
            Dispensar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
