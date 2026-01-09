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
  getWebhookUrl,
  Channel,
  ChannelProviderConfig,
} from '@/hooks/useChannels';
import { useOnboarding } from '@/hooks/useOnboarding';

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
  const [baseUrl, setBaseUrl] = useState('https://api.notificame.com.br');
  const [webhookSecret, setWebhookSecret] = useState('');
  
  const createChannel = useCreateChannel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !apiKey.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o nome e o token da API.',
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
          base_url: baseUrl.trim(),
          webhook_secret: webhookSecret.trim() || undefined,
        },
      },
    });

    setOpen(false);
    setName('');
    setPhoneNumber('');
    setApiKey('');
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
      <DialogContent className="max-w-lg">
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
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">Token da API (NotificaMe) *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Seu token do BSP"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="baseUrl">URL Base da API</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.notificame.com.br"
            />
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
  const [baseUrl, setBaseUrl] = useState(
    (channel.provider_config as ChannelProviderConfig)?.base_url || ''
  );
  
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  
  const webhookUrl = getWebhookUrl(channel.id);

  const handleSave = async () => {
    const input: Record<string, unknown> = {
      name: name.trim(),
      phone_number: phoneNumber.trim() || null,
    };
    
    if (apiKey.trim() || baseUrl.trim()) {
      input.provider_config = {};
      if (apiKey.trim()) (input.provider_config as Record<string, unknown>).api_key = apiKey.trim();
      if (baseUrl.trim()) (input.provider_config as Record<string, unknown>).base_url = baseUrl.trim();
    }

    await updateChannel.mutateAsync({
      channelId: channel.id,
      input: input as Parameters<typeof updateChannel.mutateAsync>[0]['input'],
    });
    
    setEditOpen(false);
    setApiKey('');
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteChannel.mutateAsync(channel.id);
    onDelete();
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
      </CardContent>
      
      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
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
            
            <div className="space-y-2">
              <Label htmlFor="edit-apiKey">Novo Token da API (deixe vazio para manter)</Label>
              <Input
                id="edit-apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="••••••••••••"
              />
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
      <div className="space-y-6 max-w-4xl">
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
        
        {/* Channels List */}
        {!isLoading && tenantData?.tenantId && (
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
        )}
      </div>
    </DashboardLayout>
  );
}
