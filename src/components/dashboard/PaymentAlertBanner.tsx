/**
 * PaymentAlertBanner Component
 * 
 * Exibe um alerta global no Dashboard quando é detectado
 * erro 131042 (Meta Business payment issue) em qualquer campanha.
 * 
 * REGRAS CRÍTICAS (evitar falsos positivos):
 * 1. TTL de 15 minutos: o banner some após este tempo sem novos erros
 * 2. Auto-desativação: some automaticamente após QUALQUER envio bem-sucedido
 * 3. Só considera erros 131042 se NÃO houver sent/delivered/read recente
 * 4. Erros antigos (antes do último sucesso) são ignorados
 */

import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

// TTL reduzido para 15 minutos - erros antigos não devem bloquear
const PAYMENT_ERROR_TTL_MINUTES = 15;

// Erros de pagamento conhecidos da Meta
const PAYMENT_ERROR_CODES = ['131042', '131026', '131049'];

interface PaymentIssueState {
  isActive: boolean;
  lastSeenAt: Date | null;
  hasSuccessAfterError: boolean;
  debugInfo?: string;
}

interface PaymentAlertBannerProps {
  tenantId?: string;
}

export function PaymentAlertBanner({ tenantId }: PaymentAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const { data: paymentState } = useQuery({
    queryKey: ['payment-issue-check', tenantId],
    queryFn: async (): Promise<PaymentIssueState> => {
      const now = new Date();
      const ttlCutoff = new Date(now.getTime() - PAYMENT_ERROR_TTL_MINUTES * 60 * 1000);

      // 1. PRIMEIRO: Verificar se houve QUALQUER sucesso recente (últimos 5 min)
      // Se sim, não mostrar banner mesmo que tenha erro
      const recentSuccessCutoff = new Date(now.getTime() - 5 * 60 * 1000);
      
      const { data: recentSuccess } = await supabase
        .from('mt_messages')
        .select('id, sent_at')
        .eq('direction', 'outbound')
        .in('status', ['sent', 'delivered', 'read'])
        .gte('sent_at', recentSuccessCutoff.toISOString())
        .limit(1);
      
      if (recentSuccess && recentSuccess.length > 0) {
        // Houve sucesso nos últimos 5 min - não mostrar banner
        return { 
          isActive: false, 
          lastSeenAt: null, 
          hasSuccessAfterError: true,
          debugInfo: 'Recent success found, banner disabled'
        };
      }

      // 2. Buscar o erro de pagamento mais recente dentro da janela TTL
      let lastPaymentErrorAt: Date | null = null;

      // Verificar em webhooks - apenas erros 131042 específicos
      let webhookQuery = supabase
        .from('mt_webhook_events')
        .select('received_at, provider_error_code, provider_error_message')
        .gte('received_at', ttlCutoff.toISOString())
        .order('received_at', { ascending: false })
        .limit(50);

      if (tenantId) {
        webhookQuery = webhookQuery.eq('tenant_id', tenantId);
      }

      const { data: webhooks } = await webhookQuery;

      if (webhooks) {
        for (const webhook of webhooks) {
          // Verificar se é erro de pagamento específico
          const errorCode = webhook.provider_error_code || '';
          const errorMessage = (webhook.provider_error_message || '').toLowerCase();
          
          const isPaymentError = PAYMENT_ERROR_CODES.includes(errorCode) ||
            errorMessage.includes('payment') ||
            errorMessage.includes('billing') ||
            errorMessage.includes('131042');
          
          if (isPaymentError) {
            const errorTime = new Date(webhook.received_at);
            if (!lastPaymentErrorAt || errorTime > lastPaymentErrorAt) {
              lastPaymentErrorAt = errorTime;
            }
          }
        }
      }

      // Se não encontrou erro de pagamento dentro do TTL, não está ativo
      if (!lastPaymentErrorAt) {
        return { 
          isActive: false, 
          lastSeenAt: null, 
          hasSuccessAfterError: false,
          debugInfo: 'No payment errors in TTL window'
        };
      }

      // 3. Verificar se houve QUALQUER envio bem-sucedido APÓS o último erro
      const { data: successAfterError } = await supabase
        .from('mt_messages')
        .select('id')
        .eq('direction', 'outbound')
        .in('status', ['sent', 'delivered', 'read'])
        .gt('sent_at', lastPaymentErrorAt.toISOString())
        .limit(1);

      // Também verificar em campaign_recipients
      const { data: campaignSuccessAfter } = await supabase
        .from('campaign_recipients')
        .select('id')
        .in('status', ['sent', 'delivered', 'read'])
        .gt('sent_at', lastPaymentErrorAt.toISOString())
        .limit(1);

      const hasSuccessAfterError = 
        (successAfterError && successAfterError.length > 0) ||
        (campaignSuccessAfter && campaignSuccessAfter.length > 0);

      // Se houve sucesso após o erro, desativar o banner
      if (hasSuccessAfterError) {
        return { 
          isActive: false, 
          lastSeenAt: lastPaymentErrorAt, 
          hasSuccessAfterError: true,
          debugInfo: 'Success after error found, banner disabled'
        };
      }

      // 4. VALIDAÇÃO FINAL: Verificar se a campanha mais recente teve sucesso
      // Se sim, erro é de campanha anterior e não deve bloquear
      const { data: latestCampaign } = await supabase
        .from('mt_campaigns')
        .select('id, sent_count, delivered_count, failed_count, completed_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestCampaign) {
        const hasDeliveries = (latestCampaign.delivered_count || 0) > 0;
        const hasSent = (latestCampaign.sent_count || 0) > 0;
        
        // Se a campanha mais recente teve entregas, o erro é obsoleto
        if (hasDeliveries || hasSent) {
          return { 
            isActive: false, 
            lastSeenAt: lastPaymentErrorAt, 
            hasSuccessAfterError: true,
            debugInfo: 'Latest campaign has deliveries, error is stale'
          };
        }
      }

      // Banner ativo: erro dentro do TTL e sem sucesso posterior
      return { 
        isActive: true, 
        lastSeenAt: lastPaymentErrorAt, 
        hasSuccessAfterError: false,
        debugInfo: `Payment error at ${lastPaymentErrorAt.toISOString()}, no success after`
      };
    },
    refetchInterval: 30000,
    staleTime: 15000,
    enabled: !dismissed, // Não executar se já foi dispensado
  });

  const isActive = paymentState?.isActive ?? false;

  if (!isActive || dismissed) {
    return null;
  }

  return (
    <Alert 
      variant="destructive" 
      className="relative bg-destructive/10 border-destructive/50 mb-6"
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
            className="border-destructive/50 hover:bg-destructive/10"
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
