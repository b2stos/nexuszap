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
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantRole } from '@/hooks/useTenantRole';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  } | null;
}

const statusConfig = {
  connected: { label: 'Conectado', icon: CheckCircle2, color: 'bg-green-500' },
  disconnected: { label: 'Desconectado', icon: XCircle, color: 'bg-gray-500' },
  error: { label: 'Erro', icon: AlertCircle, color: 'bg-red-500' },
  pending: { label: 'Pendente', icon: AlertCircle, color: 'bg-yellow-500' },
};

export function IntegrationsSettings() {
  const { tenantId } = useTenantRole();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Integrações</h3>
          <p className="text-sm text-muted-foreground">
            Status dos canais conectados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
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
                  Vá para a seção Canais para conectar seu WhatsApp
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/dashboard/channels">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ir para Canais
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => {
            const status = statusConfig[channel.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <Card key={channel.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className={`p-1.5 rounded ${status.color}`}>
                        <StatusIcon className="h-4 w-4 text-white" />
                      </div>
                      {channel.name}
                    </CardTitle>
                    <Badge variant={channel.status === 'connected' ? 'default' : 'secondary'}>
                      {status.label}
                    </Badge>
                  </div>
                  <CardDescription>
                    {channel.provider?.display_name || 'Provedor desconhecido'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Phone Number */}
                    {channel.phone_number && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <div>
                          <p className="text-xs text-muted-foreground">Número</p>
                          <p className="text-sm font-medium">{channel.phone_number}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(channel.phone_number!, 'Número')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Verified Name */}
                    {channel.verified_name && (
                      <div className="p-2 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">Nome Verificado</p>
                        <p className="text-sm font-medium">{channel.verified_name}</p>
                      </div>
                    )}

                    {/* WABA ID */}
                    {channel.provider_config?.wabaId && (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <div>
                          <p className="text-xs text-muted-foreground">WABA ID</p>
                          <p className="text-sm font-medium font-mono">
                            {channel.provider_config.wabaId}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(channel.provider_config!.wabaId!, 'WABA ID')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Meta Token Status */}
                    <div className="p-2 rounded-lg bg-muted">
                      <p className="text-xs text-muted-foreground">Token Meta</p>
                      <div className="flex items-center gap-2">
                        {channel.provider_config?.hasMetaToken ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 dark:text-green-400">Configurado</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-600 dark:text-yellow-400">Não configurado</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quality Rating */}
                    {channel.quality_rating && (
                      <div className="p-2 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">Qualidade</p>
                        <Badge variant="outline" className="mt-1">
                          {channel.quality_rating}
                        </Badge>
                      </div>
                    )}

                    {/* Last Connected */}
                    {channel.last_connected_at && (
                      <div className="p-2 rounded-lg bg-muted">
                        <p className="text-xs text-muted-foreground">Última Conexão</p>
                        <p className="text-sm">
                          {formatDistanceToNow(new Date(channel.last_connected_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
