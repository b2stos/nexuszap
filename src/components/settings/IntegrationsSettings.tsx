import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plug, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Copy,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantRole } from '@/hooks/useTenantRole';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Channel {
  id: string;
  name: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  verified_name: string | null;
  quality_rating: string | null;
  last_connected_at: string | null;
  provider: {
    name: string;
    display_name: string;
  };
  provider_config: {
    wabaId?: string;
    hasMetaToken?: boolean;
    metaAccessToken?: string;
    phoneNumberId?: string;
  } | null;
}

const statusConfig = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  disconnected: { label: 'Desconectado', icon: XCircle, color: 'text-gray-500', bgColor: 'bg-gray-500/10' },
  error: { label: 'Erro', icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  pending: { label: 'Pendente', icon: AlertCircle, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
};

export function IntegrationsSettings() {
  const { tenantId } = useTenantRole();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchChannels();
    }
  }, [tenantId]);

  const fetchChannels = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .select(`
          id,
          name,
          phone_number,
          status,
          verified_name,
          quality_rating,
          last_connected_at,
          provider_config,
          provider:providers(name, display_name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match expected type
      const transformedChannels: Channel[] = (data || []).map(ch => ({
        ...ch,
        status: ch.status as Channel['status'],
        provider: Array.isArray(ch.provider) ? ch.provider[0] : ch.provider,
        provider_config: ch.provider_config as Channel['provider_config'],
      }));

      setChannels(transformedChannels);
    } catch (err) {
      console.error('Error fetching channels:', err);
      toast.error('Erro ao carregar canais');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchChannels();
    setIsRefreshing(false);
    toast.success('Status atualizado');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  // Determine if NotificaMe (BSP) is configured
  const notificameChannel = channels.find(ch => 
    ch.provider?.name?.toLowerCase().includes('notificame') || 
    ch.provider?.display_name?.toLowerCase().includes('notificame')
  );

  // Determine if Meta Cloud API is configured
  const metaChannel = channels.find(ch => 
    ch.provider_config?.wabaId || 
    ch.provider_config?.metaAccessToken ||
    ch.provider?.name?.toLowerCase().includes('meta')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Integrações</h3>
          <p className="text-sm text-muted-foreground">
            Status dos canais e APIs conectadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => navigate('/dashboard/channels')}>
            Gerenciar Canais
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <Plug className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h4 className="font-medium">Nenhum canal conectado</h4>
                <p className="text-sm text-muted-foreground">
                  Conecte seu WhatsApp para começar a usar a plataforma
                </p>
              </div>
              <Button onClick={() => navigate('/dashboard/channels')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ir para Canais
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* NotificaMe (BSP) Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">NotificaMe (BSP)</CardTitle>
                {notificameChannel ? (
                  <Badge variant="default" className="bg-green-500">
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    Não configurado
                  </Badge>
                )}
              </div>
              <CardDescription>
                Provedor oficial WhatsApp Business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {notificameChannel ? (
                <>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Canal</span>
                      <span className="text-sm font-medium">{notificameChannel.name}</span>
                    </div>
                    {notificameChannel.phone_number && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <span className="text-sm text-muted-foreground">Número</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{notificameChannel.phone_number}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(notificameChannel.phone_number!, 'Número')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const status = statusConfig[notificameChannel.status] || statusConfig.pending;
                          const StatusIcon = status.icon;
                          return (
                            <>
                              <StatusIcon className={`h-4 w-4 ${status.color}`} />
                              <span className="text-sm">{status.label}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {notificameChannel.last_connected_at && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <span className="text-sm text-muted-foreground">Última atividade</span>
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(notificameChannel.last_connected_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum canal NotificaMe configurado
                </p>
              )}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/dashboard/channels')}
              >
                Gerenciar em Canais
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Meta Cloud API Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Meta Cloud API</CardTitle>
                {metaChannel?.provider_config?.wabaId ? (
                  <Badge variant="default" className="bg-blue-500">
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    Não configurado
                  </Badge>
                )}
              </div>
              <CardDescription>
                API oficial do WhatsApp via Meta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metaChannel ? (
                <>
                  <div className="grid gap-2">
                    {metaChannel.provider_config?.wabaId && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <span className="text-sm text-muted-foreground">WABA ID</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{metaChannel.provider_config.wabaId}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(metaChannel.provider_config!.wabaId!, 'WABA ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {metaChannel.provider_config?.phoneNumberId && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <span className="text-sm text-muted-foreground">Phone Number ID</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono truncate max-w-[120px]">
                            {metaChannel.provider_config.phoneNumberId}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(metaChannel.provider_config!.phoneNumberId!, 'Phone Number ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                      <span className="text-sm text-muted-foreground">Token Meta</span>
                      <div className="flex items-center gap-2">
                        {metaChannel.provider_config?.metaAccessToken || metaChannel.provider_config?.hasMetaToken ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">Configurado</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">Pendente</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Configure o WABA ID e Token Meta em Canais
                </p>
              )}
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate('/dashboard/channels')}
              >
                Gerenciar em Canais
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Connected Channels Summary */}
      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Todos os Canais</CardTitle>
            <CardDescription>
              {channels.length} {channels.length === 1 ? 'canal conectado' : 'canais conectados'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {channels.map((channel) => {
                const status = statusConfig[channel.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div 
                    key={channel.id} 
                    className={`flex items-center justify-between p-3 rounded-lg ${status.bgColor}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`h-5 w-5 shrink-0 ${status.color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{channel.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {channel.provider?.display_name} • {channel.phone_number || 'Sem número'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
