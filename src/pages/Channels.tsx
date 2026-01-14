/**
 * Channels Page
 * 
 * Página de configuração de canais WhatsApp (BSP NotificaMe)
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useProtectedUser } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Phone,
  Plus,
  Settings,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Webhook,
  Key,
  Globe,
  AlertTriangle,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useCurrentTenantForChannels,
  useNotificaMeProvider,
  useChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useTestChannel,
  useValidateToken,
  getWebhookUrl,
  Channel,
  ChannelProviderConfig,
  DiscoveredChannel,
} from '@/hooks/useChannels';
import { useOnboarding } from '@/hooks/useOnboarding';
import { WebhookMonitorMT } from '@/components/dashboard/WebhookMonitorMT';

// Track onboarding when a channel is created
function useTrackChannelCreation(channelsCount: number) {
  const { state, completeStep } = useOnboarding();
  
  useEffect(() => {
    // Mark channel_connected step when there's at least one channel
    if (channelsCount > 0 && state && !state.channel_connected_at) {
      completeStep('channel_connected');
    }
  }, [channelsCount, state?.channel_connected_at]);
}


function ChannelStatusBadge({ status }: { status: Channel['status'] }) {
  switch (status) {
    case 'connected':
      return <Badge className="bg-green-500 hover:bg-green-600">Conectado</Badge>;
    case 'disconnected':
      return <Badge variant="destructive">Desconectado</Badge>;
    case 'error':
      return <Badge variant="destructive">Erro</Badge>;
    case 'pending':
      return <Badge variant="secondary">Pendente</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// Indicador de saúde do canal baseado em last_connected_at
function ChannelHealthIndicator({ lastConnectedAt }: { lastConnectedAt: string | null }) {
  if (!lastConnectedAt) {
    return <span className="text-muted-foreground">Nunca conectado</span>;
  }
  
  const lastConnected = new Date(lastConnectedAt);
  const now = new Date();
  const minutesSince = Math.floor((now.getTime() - lastConnected.getTime()) / (1000 * 60));
  
  if (minutesSince < 10) {
    return (
      <span className="inline-flex items-center gap-1.5 text-green-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Ativo
      </span>
    );
  } else if (minutesSince < 60) {
    return (
      <span className="inline-flex items-center gap-1.5 text-orange-600 font-medium">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        Aguardando ({minutesSince}min)
      </span>
    );
  } else {
    const hours = Math.floor(minutesSince / 60);
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground font-medium">
        <span className="w-2 h-2 rounded-full bg-gray-400" />
        Sem atividade ({hours}h)
      </span>
    );
  }
}

function ChannelStatusIcon({ status }: { status: Channel['status'] }) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'disconnected':
    case 'error':
      return <XCircle className="w-5 h-5 text-destructive" />;
    case 'pending':
      return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    default:
      return null;
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: `${label} copiado!` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="icon" onClick={copy}>
      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

// Helper: check if value looks like a UUID
function looksLikeUUID(value: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return UUID_REGEX.test(value.trim());
}

// Helper: check if token is valid (any string >= 10 chars after trim)
// NotificaMe tokens CAN be UUIDs - this is their official format
function isValidToken(value: string): boolean {
  const clean = value.trim();
  return clean.length >= 10;
}

function CreateChannelDialog({
  tenantId,
  providerId,
  onCreated,
}: {
  tenantId: string;
  providerId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [discoveredChannels, setDiscoveredChannels] = useState<DiscoveredChannel[]>([]);
  const [showManualInput, setShowManualInput] = useState(false);
  
  const createChannel = useCreateChannel();
  const validateToken = useValidateToken();
  const testChannel = useTestChannel();

  const handleValidateToken = async () => {
    const trimmedApiKey = apiKey.trim();
    
    if (!trimmedApiKey) {
      toast({
        title: 'Token obrigatório',
        description: 'Cole seu Token do NotificaMe.',
        variant: 'destructive',
      });
      return;
    }

    // Validate minimum token length (10 chars)
    if (trimmedApiKey.length < 10) {
      toast({
        title: 'Token muito curto',
        description: `O token deve ter pelo menos 10 caracteres. Você colou ${trimmedApiKey.length} caracteres.`,
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateToken.mutateAsync({ token: trimmedApiKey });
      
      if (result.valid && result.channels && result.channels.length > 0) {
        setDiscoveredChannels(result.channels);
        // Auto-select first channel
        setSubscriptionId(result.channels[0].id);
        if (result.channels[0].phone) {
          setPhoneNumber(result.channels[0].phone);
        }
        // Auto-fill name if empty
        if (!name && result.channels[0].name) {
          setName(result.channels[0].name);
        }
      } else if (result.valid) {
        // Token valid but no channels discovered
        setShowManualInput(true);
        toast({
          title: 'Token válido!',
          description: 'Não foi possível descobrir canais automaticamente. Informe o Subscription ID manualmente.',
        });
      }
    } catch (error) {
      // Error handled by mutation
    }
    setIsValidating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedSubscriptionId = subscriptionId.trim();
    const trimmedApiKey = apiKey.trim();
    
    if (!name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Preencha o nome do canal.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!trimmedApiKey) {
      toast({
        title: 'Token obrigatório',
        description: 'Informe o Token do NotificaMe para conectar o canal.',
        variant: 'destructive',
      });
      return;
    }

    // Validate minimum token length
    if (trimmedApiKey.length < 10) {
      toast({
        title: 'Token muito curto',
        description: `Token deve ter pelo menos 10 caracteres. Atual: ${trimmedApiKey.length}`,
        variant: 'destructive',
      });
      return;
    }
    
    if (!trimmedSubscriptionId) {
      toast({
        title: 'Canal não selecionado',
        description: 'Valide o token primeiro ou informe o Subscription ID manualmente.',
        variant: 'destructive',
      });
      return;
    }

    // Validate subscription_id is a UUID
    if (!looksLikeUUID(trimmedSubscriptionId)) {
      toast({
        title: 'Subscription ID inválido',
        description: 'O Subscription ID deve ser um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
        variant: 'destructive',
      });
      return;
    }

    // CRITICAL: Prevent api_key === subscription_id misconfiguration
    if (trimmedApiKey === trimmedSubscriptionId) {
      toast({
        title: 'Configuração incorreta',
        description: 'O Token e o Subscription ID não podem ser iguais. O Token é o código de autenticação (Configurações → API). O Subscription ID é o UUID do canal.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create the channel
      const newChannel = await createChannel.mutateAsync({
        tenantId,
        providerId,
        input: {
          name: name.trim(),
          phone_number: phoneNumber.trim() || undefined,
          provider_config: {
            subscription_id: trimmedSubscriptionId,
            api_key: trimmedApiKey,
          },
        },
      });

      // Auto-test after creation
      if (newChannel?.id) {
        try {
          await testChannel.mutateAsync(newChannel.id);
        } catch {
          // Test failed, but channel was created
          toast({
            title: 'Canal criado',
            description: 'Canal criado, mas a validação falhou. Verifique as credenciais.',
            variant: 'default',
          });
        }
      }

      setOpen(false);
      resetForm();
      onCreated();
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setSubscriptionId('');
    setApiKey('');
    setDiscoveredChannels([]);
    setShowManualInput(false);
    setIsValidating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Conectar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp (NotificaMe)</DialogTitle>
          <DialogDescription>
            Cole seu único token do NotificaMe. O sistema irá descobrir automaticamente seus canais.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Canal *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: WhatsApp Principal"
              required
            />
          </div>
          
          <Separator />
          
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Key className="w-4 h-4" />
              Credenciais NotificaMe (apenas 1 token!)
            </div>
            
            {/* Token field */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                Token do NotificaMe *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setDiscoveredChannels([]);
                    setShowManualInput(false);
                  }}
                  placeholder="Cole seu token aqui"
                  required
                  className="font-mono text-sm flex-1"
                />
                <Button 
                  type="button" 
                  variant="secondary"
                  onClick={handleValidateToken}
                  disabled={isValidating || !apiKey.trim()}
                  title="Validar token e descobrir canais"
                >
                  {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole aqui o token oficial do NotificaMe (Configurações → API → Token).
              </p>
            </div>

            {/* Discovered channels */}
            {discoveredChannels.length > 0 && (
              <div className="space-y-2">
                <Label>Canal WhatsApp Descoberto</Label>
                <div className="space-y-2">
                  {discoveredChannels.map((ch) => (
                    <div
                      key={ch.id}
                      onClick={() => {
                        setSubscriptionId(ch.id);
                        if (ch.phone) setPhoneNumber(ch.phone);
                        if (ch.name && !name) setName(ch.name);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        subscriptionId === ch.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-500" />
                          <span className="font-medium">{ch.name || ch.phone || 'Canal WhatsApp'}</span>
                        </div>
                        {subscriptionId === ch.id && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      {ch.phone && <p className="text-xs text-muted-foreground mt-1">{ch.phone}</p>}
                      <p className="text-xs text-muted-foreground font-mono">ID: {ch.id}</p>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowManualInput(true)}
                >
                  Não encontrou? Informe manualmente
                </Button>
              </div>
            )}

            {/* Manual subscription ID input */}
            {(showManualInput || (discoveredChannels.length === 0 && validateToken.isSuccess && validateToken.data?.valid)) && (
              <div className="space-y-2">
                <Label htmlFor="subscriptionId">
                  Subscription ID (UUID do canal) *
                </Label>
                <Input
                  id="subscriptionId"
                  value={subscriptionId}
                  onChange={(e) => setSubscriptionId(e.target.value)}
                  placeholder="Ex: 066f4d91-fd0c-4726-8b1c-85325c80b75a"
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Encontrado em: <span className="font-medium">NotificaMe → Canais → WhatsApp → Detalhes</span>
                </p>
                {subscriptionId && !looksLikeUUID(subscriptionId.trim()) && subscriptionId.length > 5 && (
                  <p className="text-xs text-destructive font-medium">
                    ⚠️ Isso não parece ser um UUID. O Subscription ID deve ter formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                  </p>
                )}
              </div>
            )}
            
            {/* Phone number (optional) */}
            {(discoveredChannels.length > 0 || showManualInput) && (
              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp (opcional)</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createChannel.isPending || !subscriptionId.trim() || !apiKey.trim()}
            >
              {createChannel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conectar Canal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChannelCard({
  channel,
  onUpdate,
  onDelete,
}: {
  channel: Channel;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(channel.name);
  const [phoneNumber, setPhoneNumber] = useState(channel.phone_number || '');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const testChannel = useTestChannel();
  
  const webhookUrl = getWebhookUrl(channel.id);
  const config = channel.provider_config as ChannelProviderConfig;
  
  // Detect misconfiguration: api_key === subscription_id
  const hasMisconfiguration = config?.api_key && config?.subscription_id && config.api_key === config.subscription_id;

  const handleSave = async () => {
    const trimmedSubscriptionId = subscriptionId.trim();
    const trimmedApiKey = apiKey.trim();
    
    // Validate token if provided - minimum length only (UUID format is valid)
    if (trimmedApiKey && trimmedApiKey.length < 10) {
      toast({
        title: 'Token muito curto',
        description: `Token deve ter pelo menos 10 caracteres. Atual: ${trimmedApiKey.length}`,
        variant: 'destructive',
      });
      return;
    }
    
    // Validate new subscription ID if provided
    if (trimmedSubscriptionId && !looksLikeUUID(trimmedSubscriptionId)) {
      toast({
        title: 'Subscription ID inválido',
        description: 'Deve ser um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
        variant: 'destructive',
      });
      return;
    }

    // CRITICAL: Detect misconfiguration - api_key should not equal subscription_id
    const effectiveApiKey = trimmedApiKey || config?.api_key;
    const effectiveSubId = trimmedSubscriptionId || config?.subscription_id;
    if (effectiveApiKey && effectiveSubId && effectiveApiKey === effectiveSubId) {
      toast({
        title: 'Configuração incorreta',
        description: 'O Token e o Subscription ID não podem ser iguais. O Token é o código de autenticação da API (NotificaMe → Configurações → API). O Subscription ID é o UUID do canal específico.',
        variant: 'destructive',
      });
      return;
    }
    
    const input: Record<string, unknown> = {
      name: name.trim(),
      phone_number: phoneNumber.trim() || null,
    };
    
    const providerConfigUpdates: Record<string, unknown> = {};
    if (trimmedSubscriptionId) providerConfigUpdates.subscription_id = trimmedSubscriptionId;
    if (trimmedApiKey) providerConfigUpdates.api_key = trimmedApiKey;
    if (wabaId.trim()) providerConfigUpdates.waba_id = wabaId.trim();
    if (accessToken.trim()) providerConfigUpdates.access_token = accessToken.trim();
    
    if (Object.keys(providerConfigUpdates).length > 0) {
      input.provider_config = providerConfigUpdates;
    }

    await updateChannel.mutateAsync({
      channelId: channel.id,
      input: input as Parameters<typeof updateChannel.mutateAsync>[0]['input'],
    });
    
    // Test connection if token was updated
    if (trimmedApiKey) {
      setIsValidating(true);
      try {
        await testChannel.mutateAsync(channel.id);
      } catch {
        // Error handled by mutation
      }
      setIsValidating(false);
    }
    
    setEditOpen(false);
    setSubscriptionId('');
    setApiKey('');
    setWabaId('');
    setAccessToken('');
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteChannel.mutateAsync(channel.id);
    onDelete();
  };

  const handleTestConnection = async () => {
    await testChannel.mutateAsync(channel.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {channel.name}
                <ChannelStatusBadge status={channel.status} />
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                {channel.phone_number || 'Número não configurado'}
                {channel.verified_name && (
                  <>
                    <span>•</span>
                    <span>{channel.verified_name}</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestConnection}
              disabled={testChannel.isPending}
            >
              {testChannel.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Testar
            </Button>
            <Button variant="outline" size="icon" onClick={() => setEditOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover Canal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja remover este canal? Esta ação não pode ser desfeita.
                    Todas as conversas associadas permanecerão, mas não será possível enviar novas mensagens.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URL */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Webhook className="w-3 h-3" />
            URL do Webhook (configure no BSP)
          </Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <CopyButton value={webhookUrl} label="URL" />
          </div>
        </div>
        
        {/* Token & Subscription ID info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Key className="w-3 h-3" />
              Token
            </Label>
            <div className="font-mono text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
              {config?.api_key 
                ? `***${String(config.api_key).slice(-4)}` 
                : 'Usando fallback do servidor'}
            </div>
          </div>
          
          {config?.subscription_id && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Key className="w-3 h-3" />
                Subscription ID
              </Label>
              <div className="font-mono text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                {config.subscription_id.substring(0, 8)}...{config.subscription_id.substring(config.subscription_id.length - 4)}
              </div>
            </div>
          )}
        </div>
        
        {/* Config info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Provider:</span>
            <span className="ml-2 font-medium">{channel.provider?.display_name || 'NotificaMe'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <span className="ml-2">
              <ChannelHealthIndicator lastConnectedAt={channel.last_connected_at} />
            </span>
          </div>
        </div>
        
        {/* Status info */}
        {channel.status !== 'connected' && (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-600">Canal não conectado</p>
              <p className="text-muted-foreground">
                Clique em "Testar" para validar as credenciais. Certifique-se de que o webhook está configurado no NotificaMe.
              </p>
            </div>
          </div>
        )}
        
        {/* Missing token warning */}
        {!config?.api_key && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Token não configurado — envio bloqueado</p>
              <p className="text-muted-foreground">
                Clique em <strong>Configurações</strong> (ícone engrenagem) e adicione seu Token do NotificaMe para enviar mensagens.
              </p>
            </div>
          </div>
        )}
        
        {/* Missing subscription_id warning */}
        {!config?.subscription_id && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Subscription ID não configurado</p>
              <p className="text-muted-foreground">
                Edite o canal para adicionar o UUID do canal NotificaMe.
              </p>
            </div>
          </div>
        )}
        
        {/* CRITICAL: Misconfiguration warning - api_key equals subscription_id */}
        {hasMisconfiguration && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">⚠️ Configuração incorreta detectada</p>
              <p className="text-muted-foreground">
                O <strong>Token</strong> e o <strong>Subscription ID</strong> são iguais. Isso é um erro:
              </p>
              <ul className="text-muted-foreground list-disc ml-4 mt-1 space-y-1">
                <li><strong>Token:</strong> código de autenticação da API (NotificaMe → Configurações → API → Token)</li>
                <li><strong>Subscription ID:</strong> UUID do canal específico (NotificaMe → Canais → WhatsApp → Detalhes)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Clique em <strong>⚙️</strong> para corrigir.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Canal</DialogTitle>
            <DialogDescription>
              Atualize as configurações do canal WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Número</Label>
              <Input
                id="edit-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+55 11 99999-9999"
              />
            </div>
            
            <Separator />
            
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Key className="w-4 h-4" />
                Credenciais NotificaMe (BSP)
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-apiKey">
                  Token do NotificaMe
                </Label>
                <Input
                  id="edit-apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Deixe vazio para manter o atual"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {config?.api_key 
                    ? `✓ Token configurado (***${String(config.api_key).slice(-4)})` 
                    : '⚠️ Token OBRIGATÓRIO para envio de mensagens'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-subscriptionId">
                  Channel ID / Subscription ID
                </Label>
                <Input
                  id="edit-subscriptionId"
                  value={subscriptionId}
                  onChange={(e) => setSubscriptionId(e.target.value)}
                  placeholder="Deixe vazio para manter o atual"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {config?.subscription_id && config.subscription_id.length === 36 && !config.subscription_id.includes('/')
                    ? `✓ Atual: ${config.subscription_id.substring(0, 8)}...${config.subscription_id.substring(28)}` 
                    : '✗ Subscription ID NÃO configurado'}
                </p>
              </div>
            </div>
            
            <Separator />
            
            {/* Meta/WhatsApp Business API Section */}
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                <Globe className="w-4 h-4" />
                Meta WhatsApp Business API (para importar templates)
              </div>
              <p className="text-xs text-muted-foreground">
                Configure estas credenciais para importar templates aprovados diretamente da Meta.
              </p>

              <div className="space-y-2">
                <Label htmlFor="edit-wabaId">
                  WABA ID (WhatsApp Business Account ID) *
                </Label>
                <Input
                  id="edit-wabaId"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                  placeholder={config?.waba_id || "Ex: 123456789012345"}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {config?.waba_id 
                    ? `✓ Configurado: ${config.waba_id}` 
                    : 'Encontre em: Meta Business Suite → WhatsApp Manager → Configurações da conta → ID da Conta'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-accessToken">
                  Access Token da Meta (opcional)
                </Label>
                <Input
                  id="edit-accessToken"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Deixe vazio para usar token do BSP"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {config?.access_token 
                    ? `✓ Token Meta configurado (***${String(config.access_token).slice(-4)})` 
                    : 'Se vazio, usará o token do NotificaMe como credencial BSP'}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateChannel.isPending || isValidating}>
              {(updateChannel.isPending || isValidating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isValidating ? 'Validando...' : 'Salvar & Validar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Channels() {
  const user = useProtectedUser();
  const { data: tenantData, isLoading: tenantLoading } = useCurrentTenantForChannels();
  const { data: provider, isLoading: providerLoading } = useNotificaMeProvider();
  const { data: channels = [], isLoading: channelsLoading, refetch } = useChannels(tenantData?.tenantId);

  const isLoading = tenantLoading || providerLoading || channelsLoading;

  // Track onboarding step
  useTrackChannelCreation(channels.length);

  if (!user) {
    return (
      <DashboardLayout user={null}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
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
              <Phone className="w-8 h-8" />
              Canais WhatsApp
            </h2>
            <p className="text-muted-foreground mt-1">
              Configure seus canais de WhatsApp API Oficial (BSP NotificaMe)
            </p>
          </div>
          
          {tenantData?.tenantId && provider && (
            <CreateChannelDialog
              tenantId={tenantData.tenantId}
              providerId={provider.id}
              onCreated={() => refetch()}
            />
          )}
        </div>
        
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {/* No tenant */}
        {!isLoading && !tenantData?.tenantId && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium">Nenhuma organização encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    Você precisa estar vinculado a uma organização para configurar canais.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Main content with tabs */}
        {!isLoading && tenantData?.tenantId && (
          <Tabs defaultValue="channels" className="space-y-4">
            <TabsList>
              <TabsTrigger value="channels" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Canais
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="flex items-center gap-2">
                <Webhook className="w-4 h-4" />
                Logs Webhook
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="channels" className="space-y-4">
              {/* Info Card */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Globe className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">API Oficial do WhatsApp</h3>
                      <p className="text-sm text-muted-foreground">
                        Esta integração utiliza a API Oficial do WhatsApp via BSP (Business Solution Provider).
                        Você precisa ter uma conta ativa no NotificaMe para configurar o canal.
                      </p>
                      <Button variant="link" className="h-auto p-0 text-primary" asChild>
                        <a href="https://notificame.com.br" target="_blank" rel="noopener noreferrer">
                          Saiba mais sobre o NotificaMe
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Channels List */}
              <div className="space-y-4">
                {channels.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="font-semibold mb-1">Nenhum canal configurado</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Crie um canal para começar a enviar e receber mensagens pelo Inbox.
                        </p>
                        {provider && (
                          <CreateChannelDialog
                            tenantId={tenantData.tenantId}
                            providerId={provider.id}
                            onCreated={() => refetch()}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  channels.map((channel) => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      onUpdate={() => refetch()}
                      onDelete={() => refetch()}
                    />
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="webhooks">
              <WebhookMonitorMT />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
