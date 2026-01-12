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
  getWebhookUrl,
  Channel,
  ChannelProviderConfig,
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
  const [apiKey, setApiKey] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.notificame.com.br');
  const [webhookSecret, setWebhookSecret] = useState('');
  
  const createChannel = useCreateChannel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedApiKey = apiKey.trim();
    const trimmedSubscriptionId = subscriptionId.trim();
    
    if (!name.trim() || !trimmedApiKey || !trimmedSubscriptionId) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome, Token da API e Subscription ID.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validation: Subscription ID must be UUID format (36 chars, no slashes)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedSubscriptionId)) {
      toast({
        title: 'Subscription ID inválido',
        description: 'Deve ser um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Você pode ter colado a URL do webhook aqui por engano.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validation: API Token should NOT be a UUID (common mistake)
    if (uuidRegex.test(trimmedApiKey)) {
      toast({
        title: 'Token da API inválido',
        description: 'Você colou um UUID no campo Token. O Token é um JWT longo (100+ caracteres), não um UUID.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validation: API Token should be reasonably long (JWTs are typically 100+ chars)
    if (trimmedApiKey.length < 50) {
      toast({
        title: 'Token da API parece curto',
        description: 'O Token de API do NotificaMe é geralmente um JWT longo (100+ caracteres). Verifique se copiou o valor completo.',
        variant: 'destructive',
      });
      return;
    }

    await createChannel.mutateAsync({
      tenantId,
      providerId,
      input: {
        name: name.trim(),
        phone_number: phoneNumber.trim() || undefined,
        provider_config: {
          api_key: apiKey.trim(),
          subscription_id: subscriptionId.trim(),
          base_url: baseUrl.trim(),
          webhook_secret: webhookSecret.trim() || undefined,
        },
      },
    });

    setOpen(false);
    setName('');
    setPhoneNumber('');
    setApiKey('');
    setSubscriptionId('');
    setWebhookSecret('');
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Canal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Canal WhatsApp</DialogTitle>
          <DialogDescription>
            Configure um novo canal para enviar e receber mensagens via API Oficial (NotificaMe BSP).
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
          
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Número conectado ao BSP (será preenchido automaticamente após configuração)
            </p>
          </div>
          
          <Separator />
          
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Key className="w-4 h-4" />
              Credenciais NotificaMe (Hub API)
            </div>
            
            {/* API Token - for authentication header */}
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-1">
                Token da API (X-API-Token) *
                <span className="text-xs text-muted-foreground font-normal ml-1">— para envio outbound</span>
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ex: eyJhbGciOiJIUzI1NiIsIn... (JWT longo)"
                required
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                <strong>Atenção:</strong> Este é o <strong>JWT/Bearer token</strong> encontrado em:{' '}
                <span className="font-medium">NotificaMe → Configurações → API → Token de Acesso</span>.{' '}
                <strong>NÃO</strong> é o UUID do canal.
              </p>
            </div>
            
            {/* Subscription ID - for "from" field */}
            <div className="space-y-2">
              <Label htmlFor="subscriptionId" className="flex items-center gap-1">
                Subscription ID (canal) *
                <span className="text-xs text-muted-foreground font-normal ml-1">— usado no "from"</span>
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
                UUID do canal no NotificaMe (formato: <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>).{' '}
                Encontrado em: <span className="font-medium">NotificaMe → Canais → WhatsApp → Detalhes do canal</span>.
              </p>
            </div>
            
            {/* Validation hint */}
            <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20 text-xs text-orange-700 dark:text-orange-300">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Erros comuns: colar o <strong>Subscription ID no campo de Token</strong> ou vice-versa. 
              Token é um JWT longo (≥100 chars). Subscription ID é um UUID (36 chars).
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="baseUrl">URL Base da API</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.notificame.com.br"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Valor fixo, não altere.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Secret do Webhook (opcional)</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Para validação HMAC"
            />
            <p className="text-xs text-muted-foreground">
              Se configurado, será usado para validar a autenticidade dos webhooks
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createChannel.isPending}>
              {createChannel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Canal
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
  const [apiKey, setApiKey] = useState('');
  const [subscriptionId, setSubscriptionId] = useState('');
  const [baseUrl, setBaseUrl] = useState(
    (channel.provider_config as ChannelProviderConfig)?.base_url || ''
  );
  
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const testChannel = useTestChannel();
  
  const webhookUrl = getWebhookUrl(channel.id);
  const config = channel.provider_config as ChannelProviderConfig;

  const handleSave = async () => {
    const trimmedApiKey = apiKey.trim();
    const trimmedSubscriptionId = subscriptionId.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Validate new subscription ID if provided
    if (trimmedSubscriptionId && !uuidRegex.test(trimmedSubscriptionId)) {
      toast({
        title: 'Subscription ID inválido',
        description: 'Deve ser um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate new API key if provided
    if (trimmedApiKey) {
      if (uuidRegex.test(trimmedApiKey)) {
        toast({
          title: 'Token da API inválido',
          description: 'Você colou um UUID no campo Token. O Token é um JWT longo, não um UUID.',
          variant: 'destructive',
        });
        return;
      }
      if (trimmedApiKey.length < 50) {
        toast({
          title: 'Token da API parece curto',
          description: 'O Token de API é geralmente um JWT longo (100+ caracteres).',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const input: Record<string, unknown> = {
      name: name.trim(),
      phone_number: phoneNumber.trim() || null,
    };
    
    const providerConfigUpdates: Record<string, unknown> = {};
    if (trimmedApiKey) providerConfigUpdates.api_key = trimmedApiKey;
    if (trimmedSubscriptionId) providerConfigUpdates.subscription_id = trimmedSubscriptionId;
    if (baseUrl.trim()) providerConfigUpdates.base_url = baseUrl.trim();
    
    if (Object.keys(providerConfigUpdates).length > 0) {
      input.provider_config = providerConfigUpdates;
    }

    await updateChannel.mutateAsync({
      channelId: channel.id,
      input: input as Parameters<typeof updateChannel.mutateAsync>[0]['input'],
    });
    
    setEditOpen(false);
    setApiKey('');
    setSubscriptionId('');
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
        
        {/* Subscription ID info */}
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
        
        {/* Config info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Provider:</span>
            <span className="ml-2 font-medium">{channel.provider?.display_name || 'NotificaMe'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Qualidade:</span>
            <span className="ml-2 font-medium">{channel.quality_rating || 'N/A'}</span>
          </div>
        </div>
        
        {/* Status info */}
        {channel.status !== 'connected' && (
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-600">Canal não conectado</p>
              <p className="text-muted-foreground">
                Configure o webhook no BSP e verifique as credenciais.
              </p>
            </div>
          </div>
        )}
        
        {/* Missing credentials warning */}
        {(!config?.api_key || !config?.subscription_id) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Credenciais incompletas</p>
              <p className="text-muted-foreground">
                {!config?.api_key && 'Token da API não configurado. '}
                {!config?.subscription_id && 'Subscription ID não configurado. '}
                Edite o canal para adicionar.
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
            
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Key className="w-4 h-4" />
                Credenciais NotificaMe (Hub API)
              </div>
              
              {/* API Token */}
              <div className="space-y-2">
                <Label htmlFor="edit-apiKey" className="flex items-center gap-1">
                  Token da API (X-API-Token)
                  <span className="text-xs text-muted-foreground font-normal ml-1">— JWT longo</span>
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
                  {config?.api_key && config.api_key.length > 10
                    ? `✓ Token configurado (${config.api_key.length} chars)`
                    : '✗ Token NÃO configurado ou inválido'}
                </p>
              </div>
              
              {/* Subscription ID */}
              <div className="space-y-2">
                <Label htmlFor="edit-subscriptionId" className="flex items-center gap-1">
                  Subscription ID (canal)
                  <span className="text-xs text-muted-foreground font-normal ml-1">— UUID 36 chars</span>
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
                    ? `✓ Atual: ${config.subscription_id.substring(0, 8)}...` 
                    : '✗ Subscription ID NÃO configurado ou inválido'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-baseUrl">URL Base</Label>
              <Input
                id="edit-baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateChannel.isPending}>
              {updateChannel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
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
