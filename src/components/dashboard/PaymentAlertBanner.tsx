/**
 * PaymentAlertBanner Component
 * 
 * Exibe um alerta global no Dashboard quando é detectado
 * erro 131042 (Meta Business payment issue) em qualquer campanha.
 */

import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

interface PaymentAlertBannerProps {
  tenantId?: string;
}

export function PaymentAlertBanner({ tenantId }: PaymentAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: hasPaymentIssue } = useQuery({
    queryKey: ['payment-issue-check', tenantId],
    queryFn: async () => {
      // Verificar eventos de webhook das últimas 24 horas
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const query = supabase
        .from('mt_webhook_events')
        .select('payload_raw')
        .gte('received_at', oneDayAgo.toISOString())
        .limit(100);

      // Filtrar por tenant se disponível
      if (tenantId) {
        query.eq('tenant_id', tenantId);
      }

      const { data: webhooks } = await query;

      if (!webhooks || webhooks.length === 0) return false;

      // Verificar se algum webhook contém erro 131042
      for (const webhook of webhooks) {
        const payloadRaw = webhook.payload_raw as Record<string, unknown>;
        const body = payloadRaw?.body as Record<string, unknown>;
        const messageStatus = body?.messageStatus as Record<string, unknown>;

        if (messageStatus?.code === 'ERROR') {
          const error = messageStatus.error as Record<string, unknown>;
          if (String(error?.code) === '131042') {
            return true;
          }
        }

        // Também verificar no campo last_error de campaign_recipients
        const errorDetails = payloadRaw?.error as Record<string, unknown>;
        if (String(errorDetails?.code) === '131042') {
          return true;
        }
      }

      // Verificar também em campaign_recipients por erros recentes
      const { data: failedRecipients } = await supabase
        .from('campaign_recipients')
        .select('last_error')
        .eq('status', 'failed')
        .gte('updated_at', oneDayAgo.toISOString())
        .limit(50);

      if (failedRecipients) {
        for (const recipient of failedRecipients) {
          if (recipient.last_error?.includes('131042')) {
            return true;
          }
        }
      }

      return false;
    },
    refetchInterval: 60000, // Verificar a cada 1 minuto
    staleTime: 30000,
  });

  if (!hasPaymentIssue || dismissed) {
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
