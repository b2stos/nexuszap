/**
 * ImportTemplatesDialog Component
 * 
 * Dialog para importar templates aprovados diretamente da API oficial da Meta (WhatsApp Business Platform).
 * 
 * IMPORTANTE:
 * - Templates pertencem à Meta, NÃO ao NotificaMe
 * - O canal precisa ter WABA_ID configurado
 * - Apenas templates com status APPROVED são listados
 * 
 * STATE MACHINE:
 * - idle: estado inicial antes de selecionar canal
 * - loading: buscando templates
 * - success: fetch OK e lista > 0
 * - empty: fetch OK e lista === 0
 * - error: fetch falhou (401/403/404/5xx)
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle, RefreshCw, Info, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVariablesFromText } from '@/utils/templateParser';

// State machine states
type FetchState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface VariableSchema {
  index: number;
  key: string;
  label: string;
  required: boolean;
}

interface ExternalTemplate {
  external_id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
  variables_schema?: {
    header?: VariableSchema[];
    body?: VariableSchema[];
    button?: VariableSchema[];
  };
}

interface Channel {
  id: string;
  name: string;
  phone_number: string | null;
  provider_config: {
    waba_id?: string;
    access_token?: string;
    api_key?: string;
    phone_number_id?: string;
    business_id?: string;
  } | null;
}

// Diagnostics info from API response
interface DiagnosticsInfo {
  request_id?: string;
  waba_id?: string | null;
  phone_number_id?: string | null;
  business_id?: string | null;
  display_phone_number?: string | null;
  last_sync_at?: string;
  source?: string;
  provider_type?: string;
}

// Error structure from API
interface ApiError {
  code: string;
  message: string;
  details?: string;
}

interface ImportTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  providerId: string;
  onImportComplete: () => void;
}

export function ImportTemplatesDialog({
  open,
  onOpenChange,
  tenantId,
  providerId,
  onImportComplete,
}: ImportTemplatesDialogProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [templates, setTemplates] = useState<ExternalTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // State machine for fetch state
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [errorInfo, setErrorInfo] = useState<ApiError | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const hasWabaId = !!selectedChannel?.provider_config?.waba_id;
  const hasMetaToken = !!selectedChannel?.provider_config?.access_token;
  const hasNotificameToken = !!selectedChannel?.provider_config?.api_key;
  const canFetchTemplates = hasNotificameToken || (hasWabaId && hasMetaToken);

  // Load channels when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      loadChannels();
    }
    // Reset state when dialog closes
    if (!open) {
      setFetchState('idle');
      setErrorInfo(null);
      setDiagnostics(null);
      setShowDiagnostics(false);
      setTemplates([]);
      setSelectedTemplates(new Set());
    }
  }, [open, tenantId]);

  // Load templates when channel is selected
  useEffect(() => {
    if (selectedChannelId && canFetchTemplates) {
      loadTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplates(new Set());
      setFetchState('idle');
    }
  }, [selectedChannelId, canFetchTemplates]);

  const loadChannels = async () => {
    setIsLoadingChannels(true);

    try {
      const { data, error: queryError } = await supabase
        .from('channels')
        .select('id, name, phone_number, provider_config')
        .eq('tenant_id', tenantId)
        .eq('status', 'connected');

      if (queryError) throw queryError;

      setChannels((data || []) as Channel[]);
      
      // Auto-select first channel with WABA_ID if only one
      const channelsWithWaba = (data || []).filter(
        (c: Channel) => c.provider_config?.waba_id || c.provider_config?.api_key
      );
      if (channelsWithWaba.length === 1) {
        setSelectedChannelId(channelsWithWaba[0].id);
      }
    } catch (err) {
      console.error('Error loading channels:', err);
      toast.error('Erro ao carregar canais');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const loadTemplates = useCallback(async () => {
    if (!selectedChannelId) return;

    // Reset state machine to loading
    setFetchState('loading');
    setErrorInfo(null);
    setTemplates([]);
    setSelectedTemplates(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFetchState('error');
        setErrorInfo({ code: 'SESSION_EXPIRED', message: 'Sessão expirada. Faça login novamente.' });
        return;
      }

      const response = await supabase.functions.invoke('list-notificame-templates', {
        body: { channel_id: selectedChannelId },
      });

      // Check for edge function errors
      if (response.error) {
        console.error('Edge function error:', response.error);
        setFetchState('error');
        setErrorInfo({ 
          code: 'EDGE_FUNCTION_ERROR', 
          message: 'Erro ao buscar templates',
          details: response.error.message 
        });
        return;
      }

      const result = response.data;

      // Store diagnostics info
      if (result.meta) {
        setDiagnostics(result.meta);
      }

      // Check for API errors in response body - use new "ok" field
      if (result.ok === false || result.success === false) {
        console.error('API error:', result);
        setFetchState('error');
        setErrorInfo(result.error || { 
          code: 'UNKNOWN', 
          message: 'Erro ao buscar templates' 
        });
        return;
      }

      // Success! Check if list is empty or has templates
      const templateList = result.templates || [];
      setTemplates(templateList);

      if (templateList.length === 0) {
        setFetchState('empty');
      } else {
        setFetchState('success');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setFetchState('error');
      setErrorInfo({ 
        code: 'NETWORK_ERROR', 
        message: err instanceof Error ? err.message : 'Erro desconhecido' 
      });
    }
  }, [selectedChannelId]);

  // Get user-friendly error message based on error code
  const getErrorDisplayMessage = (error: ApiError): string => {
    const codeMap: Record<string, string> = {
      'AUTH_ERROR': 'Token inválido ou expirado. Verifique as credenciais do canal.',
      'TOKEN_INVALID': 'Access Token da Meta inválido ou expirado.',
      'INVALID_WABA': 'WABA ID inválido ou sem permissão para esta conta.',
      'RATE_LIMIT': 'Limite de requisições atingido. Aguarde alguns minutos.',
      'NO_CREDENTIALS': 'Credenciais não configuradas no canal.',
      'NO_TEMPLATE_SOURCE': 'Não foi possível acessar os templates.',
      'NO_TEMPLATE_ENDPOINT': 'O provedor não suporta listagem de templates.',
      'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet.',
      'FORBIDDEN': 'Sem permissão para acessar este canal.',
      'SESSION_EXPIRED': 'Sessão expirada. Faça login novamente.',
    };
    
    return codeMap[error.code] || error.message || 'Erro ao buscar templates.';
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const toggleTemplate = (name: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedTemplates(newSelected);
  };

  const selectAll = () => {
    if (selectedTemplates.size === templates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(templates.map(t => t.name)));
    }
  };

  const handleImport = async () => {
    if (selectedTemplates.size === 0) return;

    setIsImporting(true);

    try {
      const templatesToImport = templates.filter(t => selectedTemplates.has(t.name));
      let imported = 0;
      let skipped = 0;

      for (const template of templatesToImport) {
        // Check if template already exists
        const { data: existing } = await supabase
          .from('mt_templates')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', template.name)
          .maybeSingle();

        if (existing) {
          console.log(`Template ${template.name} already exists, skipping`);
          skipped++;
          continue;
        }

        // Parse variables from components
        const bodyComponent = template.components.find(c => c.type === 'BODY');
        const headerComponent = template.components.find(c => c.type === 'HEADER');
        
        let variablesSchema = template.variables_schema;
        
        // If no variables_schema from API, parse from text
        if (!variablesSchema || (!variablesSchema.header?.length && !variablesSchema.body?.length)) {
          const bodyResult = bodyComponent?.text ? parseVariablesFromText(bodyComponent.text, 'BODY') : { variables: [] };
          const headerResult = headerComponent?.text ? parseVariablesFromText(headerComponent.text, 'HEADER') : { variables: [] };
          
          variablesSchema = {
            header: headerResult.variables.map(v => ({
              index: v.index,
              key: `header_${v.index}`,
              label: v.label,
              required: v.required,
            })),
            body: bodyResult.variables.map(v => ({
              index: v.index,
              key: `body_${v.index}`,
              label: v.label,
              required: v.required,
            })),
            button: [],
          };
        }

        // Insert template with source='meta'
        const { error: insertError } = await supabase
          .from('mt_templates')
          .insert({
            tenant_id: tenantId,
            provider_id: providerId,
            name: template.name,
            language: template.language || 'pt_BR',
            category: template.category || 'UTILITY',
            status: 'approved',
            components: JSON.parse(JSON.stringify(template.components || [])),
            variables_schema: variablesSchema ? JSON.parse(JSON.stringify(variablesSchema)) : null,
            provider_template_id: template.external_id,
            source: 'meta',
            last_synced_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Error importing template ${template.name}:`, insertError);
        } else {
          imported++;
        }
      }

      if (imported > 0) {
        toast.success(`${imported} template(s) importado(s) com sucesso!`);
      }
      if (skipped > 0) {
        toast.info(`${skipped} template(s) já existiam e foram ignorados.`);
      }

      onImportComplete();
      onOpenChange(false);
    } catch (err) {
      console.error('Error importing templates:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao importar templates');
    } finally {
      setIsImporting(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      MARKETING: 'bg-purple-500/10 text-purple-600',
      UTILITY: 'bg-blue-500/10 text-blue-600',
      AUTHENTICATION: 'bg-orange-500/10 text-orange-600',
    };
    return colors[category.toUpperCase()] || 'bg-gray-500/10 text-gray-600';
  };

  const getVariableCount = (template: ExternalTemplate) => {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return 0;
    const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Templates da Meta (WhatsApp)
          </DialogTitle>
          <DialogDescription>
            Importe templates aprovados diretamente da sua conta WhatsApp Business na Meta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Alert */}
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
              Templates são gerenciados pela Meta (WhatsApp Business Platform). 
              Apenas templates com status <strong>APPROVED</strong> serão listados.
            </AlertDescription>
          </Alert>

          {/* Channel Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecione o Canal WhatsApp</label>
            {isLoadingChannels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando canais...
              </div>
            ) : channels.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum canal conectado. Conecte um canal WhatsApp primeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um canal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          <span>{channel.name}</span>
                          {channel.phone_number && (
                            <span className="text-muted-foreground">({channel.phone_number})</span>
                          )}
                          {!channel.provider_config?.api_key && !channel.provider_config?.access_token && (
                            <Badge variant="outline" className="text-xs text-yellow-600">
                              Sem Token
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Meta Account Info */}
                {selectedChannel && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">IDs da Conta Meta</p>
                    
                    {selectedChannel.provider_config?.waba_id ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">WABA ID:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">
                            {selectedChannel.provider_config.waba_id}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(selectedChannel.provider_config!.waba_id!, 'WABA ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-yellow-600">WABA ID não configurado</p>
                    )}

                    {selectedChannel.provider_config?.phone_number_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Phone Number ID:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">
                            {selectedChannel.provider_config.phone_number_id}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(selectedChannel.provider_config!.phone_number_id!, 'Phone Number ID')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Configuration Warning */}
                {selectedChannelId && !canFetchTemplates && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Configuração necessária para importar templates:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        {!hasNotificameToken && (
                          <li>Token do NotificaMe não configurado</li>
                        )}
                        {!hasWabaId && (
                          <li>WABA ID (ID da conta WhatsApp Business)</li>
                        )}
                        {!hasMetaToken && (
                          <li>Access Token da Meta (para buscar templates diretamente)</li>
                        )}
                      </ul>
                      <p className="mt-2 text-sm">
                        Acesse <strong>Canais → Editar</strong> para configurar estas credenciais.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          {/* Templates List - Render based on fetchState */}
          {selectedChannelId && canFetchTemplates && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Templates Aprovados
                  {fetchState === 'success' && templates.length > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({selectedTemplates.size}/{templates.length} selecionados)
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  {fetchState === 'success' && templates.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      {selectedTemplates.size === templates.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTemplates}
                    disabled={fetchState === 'loading'}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${fetchState === 'loading' ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>

              {/* State: Loading */}
              {fetchState === 'loading' && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Buscando templates na API da Meta...
                  </span>
                </div>
              )}

              {/* State: Error - ONLY show error, never empty state */}
              {fetchState === 'error' && errorInfo && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">Erro ao buscar templates</p>
                    <p className="text-sm">{getErrorDisplayMessage(errorInfo)}</p>
                    {errorInfo.details && (
                      <p className="text-xs text-muted-foreground">{errorInfo.details}</p>
                    )}
                    <div className="pt-2 flex gap-2">
                      <Button variant="outline" size="sm" onClick={loadTemplates}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Tentar novamente
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                      >
                        {showDiagnostics ? 'Ocultar' : 'Ver'} diagnóstico
                      </Button>
                    </div>
                    {/* Diagnostics panel */}
                    {showDiagnostics && diagnostics && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono space-y-1">
                        <p><strong>Request ID:</strong> {diagnostics.request_id || 'N/A'}</p>
                        <p><strong>WABA ID:</strong> {diagnostics.waba_id || 'Não configurado'}</p>
                        <p><strong>Phone Number ID:</strong> {diagnostics.phone_number_id || 'Não configurado'}</p>
                        <p><strong>Business ID:</strong> {diagnostics.business_id || 'N/A'}</p>
                        <p><strong>Provedor:</strong> {diagnostics.provider_type || 'N/A'}</p>
                        <p><strong>Fonte:</strong> {diagnostics.source || 'N/A'}</p>
                        <p><strong>Código erro:</strong> {errorInfo.code}</p>
                        <p><strong>Última tentativa:</strong> {diagnostics.last_sync_at ? new Date(diagnostics.last_sync_at).toLocaleString('pt-BR') : 'N/A'}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* State: Empty - ONLY show empty state, never error */}
              {fetchState === 'empty' && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Nenhum template aprovado encontrado</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">
                    Não existe template com status APPROVED na sua conta WhatsApp Business para este WABA.
                    Crie e aprove um template no Meta Business Suite e clique em "Atualizar".
                  </p>
                  {diagnostics?.last_sync_at && (
                    <p className="text-xs mt-3 text-muted-foreground/70">
                      Última sincronização: {new Date(diagnostics.last_sync_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              )}

              {/* State: Success - Show template list */}
              {fetchState === 'success' && templates.length > 0 && (
                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.name}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplates.has(template.name)
                            ? 'bg-primary/5 border-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleTemplate(template.name)}
                      >
                        <Checkbox
                          checked={selectedTemplates.has(template.name)}
                          onCheckedChange={() => toggleTemplate(template.name)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium font-mono text-sm">
                              {template.name}
                            </span>
                            <Badge className="bg-green-500/10 text-green-600 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aprovado
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {template.language}
                            </Badge>
                            <Badge className={`text-xs ${getCategoryBadge(template.category)}`}>
                              {template.category}
                            </Badge>
                            {getVariableCount(template) > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {getVariableCount(template)} variável(is)
                              </Badge>
                            )}
                          </div>
                          {/* Preview body text */}
                          {template.components.find(c => c.type === 'BODY')?.text && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {template.components.find(c => c.type === 'BODY')?.text}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedTemplates.size === 0 || isImporting || fetchState !== 'success'}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Importar {selectedTemplates.size > 0 && `(${selectedTemplates.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
