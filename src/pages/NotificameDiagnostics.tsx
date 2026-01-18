/**
 * NotificaMe Diagnostics Page
 * 
 * Página de diagnóstico para Super Admins verificarem status da integração
 */

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useProtectedUser } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

interface HealthCheckResponse {
  timestamp: string;
  configuration: {
    api_base_url: string;
    channels_with_token: number;
    total_channels: number;
  };
  api_connectivity: {
    success: boolean;
    status: number;
    message: string;
    url_called?: string;
    response_preview?: string;
  };
  channels: Array<{
    id: string;
    name: string;
    status: string;
    last_connected_at: string | null;
    has_subscription_id: boolean;
    has_token: boolean;
    token_preview?: string;
  }>;
  recent_webhook_errors: Array<{
    id: string;
    event_type: string;
    error: string;
    received_at: string;
  }>;
  recent_outbound_errors: Array<{
    id: string;
    error_code: string;
    error_detail: string;
    created_at: string;
  }>;
  filters?: {
    errors_since: string;
    note: string;
  };
}

/**
 * Mapeamento de códigos de erro para diagnóstico
 */
function getErrorDiagnostic(code: string | null, detail: string | null): { cause: string; action: string } {
  const errorCode = code?.toUpperCase() || '';
  const errorDetail = detail?.toLowerCase() || '';
  
  // Erro 131026 - Message Undeliverable
  if (errorCode === '131026' || errorDetail.includes('131026') || errorDetail.includes('undeliverable')) {
    return {
      cause: 'O número não possui WhatsApp, está bloqueado, optou por não receber mensagens (opt-out), ou o número é inválido.',
      action: 'Verifique se o número está correto e possui WhatsApp ativo. Confirme que o contato não solicitou opt-out. Tente enviar para outro número de teste.',
    };
  }
  
  // Erro 131047 - Re-engagement message required
  if (errorCode === '131047' || errorDetail.includes('re-engagement')) {
    return {
      cause: 'A janela de 24h expirou. É necessário usar um template aprovado para iniciar nova conversa.',
      action: 'Use a função "Enviar Template" no Inbox para reabrir a conversa com um template pré-aprovado.',
    };
  }
  
  // Erro 131042 - Payment Issue
  if (errorCode === '131042' || errorDetail.includes('131042') || errorDetail.includes('payment')) {
    return {
      cause: 'A conta Meta Business não possui forma de pagamento configurada ou há problema com o cartão cadastrado.',
      action: 'Acesse business.facebook.com → Configurações → Pagamentos e configure um método de pagamento válido.',
    };
  }
  
  // Erro 401/403 - Authentication
  if (errorCode.includes('AUTH') || errorCode === '401' || errorCode === '403' || errorDetail.includes('unauthorized') || errorDetail.includes('token')) {
    return {
      cause: 'O token de API está inválido, expirado ou não tem permissão para enviar mensagens.',
      action: 'Regenere o token no painel NotificaMe e atualize em Configurações → Canais.',
    };
  }
  
  // Erro de template não encontrado
  if (errorCode.includes('TEMPLATE') || errorDetail.includes('template not found') || errorDetail.includes('not approved')) {
    return {
      cause: 'O template não existe ou não está aprovado no Meta Business.',
      action: 'Sincronize os templates (Configurações → Templates → Sincronizar) e verifique o status de aprovação.',
    };
  }
  
  // Erro de rate limit
  if (errorCode === '429' || errorCode.includes('RATE') || errorDetail.includes('rate limit') || errorDetail.includes('too many')) {
    return {
      cause: 'Limite de requisições atingido. Muitas mensagens enviadas em curto período.',
      action: 'Aguarde alguns minutos e reduza a velocidade de envio das campanhas.',
    };
  }
  
  // Erro de canal não encontrado
  if (errorCode.includes('CHANNEL') || errorDetail.includes('channel not found') || errorDetail.includes('subscription')) {
    return {
      cause: 'O canal não está configurado corretamente ou o Subscription ID está incorreto.',
      action: 'Verifique as configurações do canal em Configurações → Canais e confirme o Subscription ID.',
    };
  }
  
  // Erro 500+
  if (errorCode.startsWith('5') || errorDetail.includes('internal') || errorDetail.includes('server error')) {
    return {
      cause: 'Instabilidade temporária no servidor do provedor (NotificaMe ou Meta).',
      action: 'Aguarde alguns minutos e tente novamente. Se persistir, verifique o status do NotificaMe.',
    };
  }
  
  // Erro genérico
  return {
    cause: 'Erro não categorizado. Verifique os detalhes da mensagem de erro.',
    action: 'Analise o código de erro e detalhes. Se persistir, entre em contato com o suporte.',
  };
}

export default function NotificameDiagnostics() {
  const user = useProtectedUser();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('notificame-health-check');
      
      if (invokeError) {
        throw new Error(invokeError.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setHealthData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao executar diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  if (!user || roleLoading) {
    return (
      <DashboardLayout user={null}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout user={user}>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-semibold">Acesso Restrito</p>
                <p className="text-sm text-muted-foreground">
                  Esta página é exclusiva para administradores.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Diagnóstico NotificaMe
            </h2>
            <p className="text-muted-foreground mt-1">
              Verifique o status da integração e identifique problemas
            </p>
          </div>
          
          <Button onClick={runHealthCheck} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Executar Diagnóstico
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-destructive" />
                <p className="text-destructive">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!healthData && !loading && !error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">Nenhum diagnóstico executado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Clique em "Executar Diagnóstico" para verificar o status da integração.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {healthData && (
          <div className="space-y-4">
            {/* Configuration Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Configuração do Servidor
                </CardTitle>
                <CardDescription>
                  Status das variáveis de ambiente e conectividade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Token Status - checks if at least one channel has token */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Token por Canal</span>
                      {healthData.channels?.some(ch => ch.has_subscription_id) ? (
                        <Badge className="bg-green-500">Configurado</Badge>
                      ) : (
                        <Badge variant="secondary">Nenhum canal</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Token configurado individualmente em cada canal
                    </p>
                  </div>

                  {/* API URL */}
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Base URL</span>
                      <Badge variant="outline">Configurado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {healthData.configuration.api_base_url}
                    </p>
                  </div>
                </div>

                {/* Connectivity Test */}
                <Separator />
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center gap-3">
                    <Wifi className={`w-5 h-5 ${healthData.api_connectivity.success ? 'text-green-500' : 'text-destructive'}`} />
                    <div>
                      <p className="font-medium">
                        Conectividade API: {healthData.api_connectivity.success ? 'OK' : 'Falha'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        HTTP {healthData.api_connectivity.status} - {healthData.api_connectivity.message}
                      </p>
                    </div>
                  </div>
                  
                  {/* URL Called */}
                  {healthData.api_connectivity.url_called && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-1">URL Chamada:</p>
                      <p className="text-xs font-mono break-all">{healthData.api_connectivity.url_called}</p>
                    </div>
                  )}
                  
                  {/* Response Preview */}
                  {healthData.api_connectivity.response_preview && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Resposta (primeiros 500 chars):</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                        {healthData.api_connectivity.response_preview}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Channels Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Canais Configurados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData.channels?.length ? (
                  <div className="space-y-2">
                    {healthData.channels.map((channel) => (
                      <div key={channel.id} className="p-3 rounded-lg border bg-card flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {channel.status === 'connected' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium">{channel.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Subscription ID: {channel.has_subscription_id ? '✓' : '✗'}
                              {channel.last_connected_at && ` • Última conexão: ${new Date(channel.last_connected_at).toLocaleString('pt-BR')}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant={channel.status === 'connected' ? 'default' : 'secondary'}>
                          {channel.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nenhum canal configurado</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Errors - Enhanced with cause/action */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Erros Recentes (Outbound)
                </CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span>Últimas 20 mensagens com falha no envio</span>
                  {healthData.filters?.note && (
                    <Badge variant="outline" className="w-fit text-xs">
                      {healthData.filters.note}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {healthData.recent_outbound_errors?.length ? (
                  <ScrollArea className="h-80">
                    <div className="space-y-3">
                      {healthData.recent_outbound_errors.map((error, idx) => {
                        const errorInfo = getErrorDiagnostic(error.error_code, error.error_detail);
                        return (
                          <div key={idx} className="p-4 rounded-lg border bg-destructive/5 border-destructive/20 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="destructive" className="text-xs font-mono">
                                {error.error_code || 'UNKNOWN'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(error.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            
                            <p className="text-sm font-medium text-foreground">
                              {error.error_detail || 'Sem detalhes'}
                            </p>
                            
                            {/* Causa provável */}
                            <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20">
                              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">
                                💡 Causa Provável:
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {errorInfo.cause}
                              </p>
                            </div>
                            
                            {/* Ação recomendada */}
                            <div className="p-2 rounded bg-primary/10 border border-primary/20">
                              <p className="text-xs font-semibold text-primary mb-1">
                                🔧 Ação Recomendada:
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {errorInfo.action}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nenhum erro recente de envio</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhook Errors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Erros de Webhook (Inbound)
                </CardTitle>
                <CardDescription>
                  Últimos 20 erros de processamento de webhook
                </CardDescription>
              </CardHeader>
              <CardContent>
                {healthData.recent_webhook_errors?.length ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {healthData.recent_webhook_errors.map((error, idx) => (
                        <div key={idx} className="p-3 rounded-lg border bg-orange-500/5 border-orange-500/20">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">
                              {error.event_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(error.received_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{error.error || 'Sem detalhes'}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nenhum erro recente de webhook</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-center">
              Diagnóstico executado em: {new Date(healthData.timestamp).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
