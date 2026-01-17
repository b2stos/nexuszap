/**
 * ImportTemplatesDialog Component
 * 
 * Dialog para sincronizar templates da Meta (WhatsApp Business Platform).
 * 
 * FEATURES:
 * - Stepper visual de progresso (Conectando → Buscando → Salvando)
 * - Contadores em tempo real por status
 * - Lista TODOS os templates (não só aprovados)
 * - Filtros internos no modal
 * - Templates aprovados podem ser importados; outros ficam para acompanhamento
 * 
 * STATE MACHINE:
 * - idle: estado inicial
 * - connecting: iniciando conexão com Meta
 * - fetching: buscando templates
 * - processing: normalizando e contando
 * - persisting: salvando no banco
 * - success: sync concluído
 * - error: falha
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Info,
  Copy,
  Settings,
  ExternalLink,
  HelpCircle,
  Clock,
  XCircle,
  PauseCircle,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  dbStatusToCanonical,
  getStatusLabel,
  getStatusColorClasses,
  type CanonicalTemplateStatus,
} from '@/utils/templateStatusMapper';

// Sync phases
type SyncPhase = 'idle' | 'connecting' | 'fetching' | 'processing' | 'persisting' | 'success' | 'error' | 'needs_meta_token';

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

// Error structure from API
interface ApiError {
  code: string;
  message: string;
  details?: string;
}

// Telemetry state
interface SyncTelemetry {
  phase: SyncPhase;
  statusMessage: string;
  progress: number;
  countsByStatus: Record<string, number>;
  totalFound: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}

// Filter options for modal
type ModalFilter = 'all' | 'approved' | 'pending' | 'rejected' | 'other';

interface ImportTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  providerId: string;
  onImportComplete: () => void;
}

// Step component for stepper
function SyncStep({ 
  step, 
  label, 
  isActive, 
  isComplete, 
  isError 
}: { 
  step: number; 
  label: string; 
  isActive: boolean; 
  isComplete: boolean;
  isError?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`
        w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
        transition-colors duration-300
        ${isError ? 'bg-destructive text-destructive-foreground' : ''}
        ${isComplete && !isError ? 'bg-green-600 text-white' : ''}
        ${isActive && !isError ? 'bg-primary text-primary-foreground animate-pulse' : ''}
        ${!isActive && !isComplete && !isError ? 'bg-muted text-muted-foreground' : ''}
      `}>
        {isComplete && !isError ? <CheckCircle className="w-4 h-4" /> : 
         isError ? <XCircle className="w-4 h-4" /> : 
         isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : 
         step}
      </div>
      <span className={`text-sm ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

// Status badge for templates
function TemplateSyncStatusBadge({ status }: { status: string }) {
  const canonical = dbStatusToCanonical(status);
  const label = getStatusLabel(status);
  const colors = getStatusColorClasses(status);
  
  const iconMap: Record<CanonicalTemplateStatus, React.ReactNode> = {
    'APPROVED': <CheckCircle className="w-3 h-3" />,
    'IN_REVIEW': <Clock className="w-3 h-3" />,
    'REJECTED': <XCircle className="w-3 h-3" />,
    'PAUSED': <PauseCircle className="w-3 h-3" />,
    'DISABLED': <PauseCircle className="w-3 h-3" />,
    'IN_APPEAL': <Clock className="w-3 h-3" />,
    'FLAGGED': <AlertCircle className="w-3 h-3" />,
    'UNKNOWN': <HelpCircle className="w-3 h-3" />,
  };
  
  return (
    <Badge className={`${colors.bg} ${colors.text} gap-1 text-xs`}>
      {iconMap[canonical]}
      {label}
    </Badge>
  );
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
  const [modalFilter, setModalFilter] = useState<ModalFilter>('all');

  // Telemetry state
  const [telemetry, setTelemetry] = useState<SyncTelemetry>({
    phase: 'idle',
    statusMessage: '',
    progress: 0,
    countsByStatus: {},
    totalFound: 0,
    startedAt: null,
    finishedAt: null,
  });
  
  const [errorInfo, setErrorInfo] = useState<ApiError | null>(null);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const hasWabaId = !!selectedChannel?.provider_config?.waba_id;
  const hasMetaToken = !!selectedChannel?.provider_config?.access_token;
  const hasNotificameToken = !!selectedChannel?.provider_config?.api_key;

  // Computed: step completion states
  const isConnectingComplete = ['fetching', 'processing', 'persisting', 'success'].includes(telemetry.phase);
  const isFetchingComplete = ['processing', 'persisting', 'success'].includes(telemetry.phase);
  const isProcessingComplete = ['persisting', 'success'].includes(telemetry.phase);
  const isPersistingComplete = telemetry.phase === 'success';

  // Filter templates for display
  const filteredTemplates = useMemo(() => {
    if (modalFilter === 'all') return templates;
    if (modalFilter === 'approved') return templates.filter(t => t.status === 'approved');
    if (modalFilter === 'pending') return templates.filter(t => t.status === 'pending');
    if (modalFilter === 'rejected') return templates.filter(t => t.status === 'rejected');
    return templates.filter(t => !['approved', 'pending', 'rejected'].includes(t.status));
  }, [templates, modalFilter]);

  // Count by filter category
  const countsByFilter = useMemo(() => ({
    all: templates.length,
    approved: templates.filter(t => t.status === 'approved').length,
    pending: templates.filter(t => t.status === 'pending').length,
    rejected: templates.filter(t => t.status === 'rejected').length,
    other: templates.filter(t => !['approved', 'pending', 'rejected'].includes(t.status)).length,
  }), [templates]);


  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTelemetry({
        phase: 'idle',
        statusMessage: '',
        progress: 0,
        countsByStatus: {},
        totalFound: 0,
        startedAt: null,
        finishedAt: null,
      });
      setErrorInfo(null);
      setShowTokenHelp(false);
      setTemplates([]);
      setSelectedTemplates(new Set());
      setModalFilter('all');
    }
  }, [open]);

  // Load channels when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      loadChannels();
    }
  }, [open, tenantId]);

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

  const startSync = useCallback(async () => {
    if (!selectedChannelId) return;

    // Check if channel has Meta credentials
    if (!hasMetaToken && hasNotificameToken) {
      setTelemetry(prev => ({ ...prev, phase: 'needs_meta_token' }));
      return;
    }

    // Reset state
    setTemplates([]);
    setSelectedTemplates(new Set());
    setErrorInfo(null);
    setModalFilter('all');

    // Start telemetry
    setTelemetry({
      phase: 'connecting',
      statusMessage: 'Conectando na API da Meta...',
      progress: 10,
      countsByStatus: {},
      totalFound: 0,
      startedAt: new Date(),
      finishedAt: null,
    });

    try {
      // Phase: Connecting
      await new Promise(r => setTimeout(r, 400)); // Brief UX delay
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw { code: 'SESSION_EXPIRED', message: 'Sessão expirada. Faça login novamente.' };
      }

      // Phase: Fetching
      setTelemetry(prev => ({
        ...prev,
        phase: 'fetching',
        statusMessage: 'Buscando templates na Meta...',
        progress: 25,
      }));

      const response = await supabase.functions.invoke('list-notificame-templates', {
        body: { channel_id: selectedChannelId },
      });

      if (response.error) {
        throw { code: 'EDGE_FUNCTION_ERROR', message: 'Erro ao buscar templates', details: response.error.message };
      }

      const result = response.data;

      // Check for META_TOKEN_REQUIRED
      if (result.requires_meta_token || result.error?.code === 'META_TOKEN_REQUIRED') {
        setTelemetry(prev => ({ ...prev, phase: 'needs_meta_token' }));
        return;
      }

      // Check for errors
      if (result.ok === false || result.success === false) {
        throw result.error || { code: 'UNKNOWN', message: 'Erro ao buscar templates' };
      }

      const templateList = result.templates || [];
      const countsByStatus = result.meta?.counts_by_status || {};

      // Phase: Processing
      setTelemetry(prev => ({
        ...prev,
        phase: 'processing',
        statusMessage: `Processando ${templateList.length} templates...`,
        progress: 60,
        totalFound: templateList.length,
        countsByStatus,
      }));

      await new Promise(r => setTimeout(r, 300)); // Brief UX delay

      // Phase: Done (for now - persisting happens on import)
      setTemplates(templateList as ExternalTemplate[]);
      
      setTelemetry(prev => ({
        ...prev,
        phase: 'success',
        statusMessage: `${templateList.length} templates encontrados`,
        progress: 100,
        finishedAt: new Date(),
      }));

    } catch (err) {
      console.error('Sync error:', err);
      const apiError = err as ApiError;
      setErrorInfo(apiError);
      setTelemetry(prev => ({
        ...prev,
        phase: 'error',
        statusMessage: apiError.message || 'Erro desconhecido',
        finishedAt: new Date(),
      }));
    }
  }, [selectedChannelId, hasMetaToken, hasNotificameToken]);

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const toggleTemplate = (name: string) => {
    const template = templates.find(t => t.name === name);
    // Only allow selecting approved templates for import
    if (template?.status !== 'approved') {
      toast.info('Apenas templates aprovados podem ser importados');
      return;
    }
    
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedTemplates(newSelected);
  };

  const selectAllApproved = () => {
    const approvedNames = templates.filter(t => t.status === 'approved').map(t => t.name);
    if (selectedTemplates.size === approvedNames.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(approvedNames));
    }
  };

  const handleImport = async () => {
    if (selectedTemplates.size === 0) return;

    setIsImporting(true);
    setTelemetry(prev => ({
      ...prev,
      phase: 'persisting',
      statusMessage: 'Salvando templates no Nexus...',
      progress: 80,
    }));

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
          skipped++;
          continue;
        }

        // Parse variables from components
        const bodyComponent = template.components.find(c => c.type === 'BODY');
        const headerComponent = template.components.find(c => c.type === 'HEADER');
        
        let variablesSchema = template.variables_schema;
        
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

        // Map status to DB enum
        const mapStatusToDbEnum = (apiStatus: string): 'approved' | 'pending' | 'rejected' => {
          const s = apiStatus?.toLowerCase() || 'pending';
          if (s === 'approved' || s === 'active') return 'approved';
          if (s === 'rejected') return 'rejected';
          return 'pending';
        };

        const { error: insertError } = await supabase
          .from('mt_templates')
          .insert({
            tenant_id: tenantId,
            provider_id: providerId,
            name: template.name,
            language: template.language || 'pt_BR',
            category: template.category || 'UTILITY',
            status: mapStatusToDbEnum(template.status),
            components: JSON.parse(JSON.stringify(template.components || [])),
            variables_schema: variablesSchema ? JSON.parse(JSON.stringify(variablesSchema)) : null,
            provider_template_id: template.external_id,
            source: 'meta',
            last_synced_at: new Date().toISOString(),
          });

        if (!insertError) {
          imported++;
        }
      }

      setTelemetry(prev => ({
        ...prev,
        phase: 'success',
        statusMessage: `${imported} template(s) importado(s)`,
        progress: 100,
        finishedAt: new Date(),
      }));

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
      setTelemetry(prev => ({ ...prev, phase: 'error' }));
    } finally {
      setIsImporting(false);
    }
  };

  const getVariableCount = (template: ExternalTemplate) => {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return 0;
    const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      MARKETING: 'bg-purple-500/10 text-purple-600',
      UTILITY: 'bg-blue-500/10 text-blue-600',
      AUTHENTICATION: 'bg-orange-500/10 text-orange-600',
    };
    return colors[category.toUpperCase()] || 'bg-gray-500/10 text-gray-600';
  };
  const isTemplateApproved = (template: ExternalTemplate) => template.status === 'approved';
  const approvedCount = countsByFilter.approved;

  // Determine if we're in a "syncing" phase
  const isSyncing = ['connecting', 'fetching', 'processing', 'persisting'].includes(telemetry.phase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sincronizar Templates da Meta
          </DialogTitle>
          <DialogDescription>
            Sincronize todos os templates da sua conta WhatsApp Business
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* Channel Selector - only show before sync or if idle */}
          {(telemetry.phase === 'idle' || telemetry.phase === 'needs_meta_token') && (
            <div className="space-y-3">
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
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Meta Account Info */}
                  {selectedChannel && (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
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
                          <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">
                            {selectedChannel.provider_config.phone_number_id}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Needs Meta Token State */}
          {telemetry.phase === 'needs_meta_token' && (
            <div className="space-y-3">
              <Alert className="bg-amber-500/10 border-amber-500/30">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Configure o Access Token da Meta</p>
                  <p className="text-sm">
                    Para listar templates, configure o <strong>WABA ID</strong> e <strong>Access Token da Meta</strong>.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => window.location.href = '/dashboard/channels'}
                      className="gap-1"
                    >
                      <Settings className="h-3 w-3" />
                      Configurar Canal
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowTokenHelp(!showTokenHelp)}
                      className="gap-1"
                    >
                      <HelpCircle className="h-3 w-3" />
                      Como gerar o token
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>

              <Collapsible open={showTokenHelp} onOpenChange={setShowTokenHelp}>
                <CollapsibleContent>
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      Como gerar o Access Token da Meta
                    </h4>
                    <ol className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">1</span>
                        <span>
                          Abra{' '}
                          <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                            Meta Business Manager <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">2</span>
                        <span>Vá em <strong>Usuários do Sistema</strong> e crie um usuário Admin</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">3</span>
                        <span>Dê acesso ao seu <strong>WhatsApp Account (WABA)</strong></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">4</span>
                        <span>Gere um token com permissões <code className="bg-background px-1 rounded text-xs">whatsapp_business_management</code></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">5</span>
                        <span>Cole no Nexus em <strong>Canais → Editar → Access Token</strong></span>
                      </li>
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Syncing States - Stepper + Telemetry */}
          {(isSyncing || telemetry.phase === 'error') && (
            <div className="space-y-4">
              {/* Stepper */}
              <div className="flex items-center justify-between px-2">
                <SyncStep 
                  step={1} 
                  label="Conectando" 
                  isActive={telemetry.phase === 'connecting'}
                  isComplete={isConnectingComplete}
                  isError={telemetry.phase === 'error' && !isConnectingComplete}
                />
                <div className="h-px flex-1 bg-border mx-2" />
                <SyncStep 
                  step={2} 
                  label="Buscando" 
                  isActive={telemetry.phase === 'fetching'}
                  isComplete={isFetchingComplete}
                  isError={telemetry.phase === 'error' && isConnectingComplete && !isFetchingComplete}
                />
                <div className="h-px flex-1 bg-border mx-2" />
                <SyncStep 
                  step={3} 
                  label="Processando" 
                  isActive={telemetry.phase === 'processing'}
                  isComplete={isProcessingComplete}
                  isError={telemetry.phase === 'error' && isFetchingComplete && !isProcessingComplete}
                />
                <div className="h-px flex-1 bg-border mx-2" />
                <SyncStep 
                  step={4} 
                  label="Salvando" 
                  isActive={telemetry.phase === 'persisting'}
                  isComplete={isPersistingComplete}
                  isError={telemetry.phase === 'error' && isProcessingComplete && !isPersistingComplete}
                />
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <Progress value={telemetry.progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">
                  {telemetry.statusMessage}
                </p>
              </div>

              {/* Counters */}
              {telemetry.totalFound > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-muted/50 p-2 rounded text-center">
                    <p className="text-lg font-bold">{telemetry.totalFound}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-green-500/10 p-2 rounded text-center">
                    <p className="text-lg font-bold text-green-600">{telemetry.countsByStatus?.approved || 0}</p>
                    <p className="text-xs text-muted-foreground">Aprovados</p>
                  </div>
                  <div className="bg-yellow-500/10 p-2 rounded text-center">
                    <p className="text-lg font-bold text-yellow-600">{telemetry.countsByStatus?.pending || 0}</p>
                    <p className="text-xs text-muted-foreground">Em análise</p>
                  </div>
                  <div className="bg-red-500/10 p-2 rounded text-center">
                    <p className="text-lg font-bold text-red-600">{telemetry.countsByStatus?.rejected || 0}</p>
                    <p className="text-xs text-muted-foreground">Reprovados</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {telemetry.phase === 'error' && errorInfo && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">Erro na sincronização</p>
                    <p className="text-sm">{errorInfo.message}</p>
                    {errorInfo.details && (
                      <p className="text-xs">{errorInfo.details}</p>
                    )}
                    <Button variant="outline" size="sm" onClick={startSync} className="mt-2">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Success State - Template List */}
          {telemetry.phase === 'success' && templates.length > 0 && (
            <div className="space-y-3">
              {/* Header with filters and sync info */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      {templates.length} templates encontrados
                    </span>
                    {approvedCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedTemplates.size}/{approvedCount} aprovados selecionados
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllApproved}>
                      {selectedTemplates.size === approvedCount ? 'Desmarcar' : 'Selecionar aprovados'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={startSync} disabled={isSyncing}>
                      <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                      Atualizar
                    </Button>
                  </div>
                </div>

                {/* Last sync timestamp */}
                {telemetry.finishedAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Sincronizado em {format(telemetry.finishedAt, "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}

                {/* Filter Chips */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                  </span>
                  <Button
                    variant={modalFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setModalFilter('all')}
                  >
                    Todos ({countsByFilter.all})
                  </Button>
                  <Button
                    variant={modalFilter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-xs ${modalFilter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => setModalFilter('approved')}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Aprovados ({countsByFilter.approved})
                  </Button>
                  <Button
                    variant={modalFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 text-xs ${modalFilter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                    onClick={() => setModalFilter('pending')}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Em análise ({countsByFilter.pending})
                  </Button>
                  {countsByFilter.rejected > 0 && (
                    <Button
                      variant={modalFilter === 'rejected' ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-xs ${modalFilter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setModalFilter('rejected')}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reprovados ({countsByFilter.rejected})
                    </Button>
                  )}
                  {countsByFilter.other > 0 && (
                    <Button
                      variant={modalFilter === 'other' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setModalFilter('other')}
                    >
                      Outros ({countsByFilter.other})
                    </Button>
                  )}
                </div>
              </div>

              {/* Info about approved-only import */}
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                  Apenas templates <strong>aprovados</strong> podem ser importados para uso em campanhas.
                  Templates em análise ficam visíveis para acompanhamento.
                </AlertDescription>
              </Alert>

              {/* Template List */}
              <ScrollArea className="h-[280px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Nenhum template nesta categoria</p>
                    </div>
                  ) : (
                    filteredTemplates.map((template) => {
                      const isApproved = isTemplateApproved(template);
                      const isSelected = selectedTemplates.has(template.name);

                      return (
                        <div
                          key={template.name}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5 border-primary/30' :
                            isApproved ? 'hover:bg-muted/50' : 'opacity-75 hover:bg-muted/30'
                          }`}
                          onClick={() => toggleTemplate(template.name)}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={!isApproved}
                            className={`mt-1 ${!isApproved ? 'opacity-50' : ''}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium font-mono text-sm">
                                {template.name}
                              </span>
                              <TemplateSyncStatusBadge status={template.status} />
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
                            {template.components.find(c => c.type === 'BODY')?.text && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {template.components.find(c => c.type === 'BODY')?.text}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State after sync */}
          {telemetry.phase === 'success' && templates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/30">
              <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum template encontrado</p>
              <p className="text-xs mt-1 max-w-sm mx-auto">
                Não existe template na sua conta WhatsApp Business para este WABA.
                Crie um template no Meta Business Suite e sincronize novamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {telemetry.phase === 'success' && selectedTemplates.size > 0 ? 'Fechar' : 'Cancelar'}
          </Button>
          
          {telemetry.phase === 'idle' && selectedChannelId && (
            <Button onClick={startSync} className="gap-1">
              <RefreshCw className="h-4 w-4" />
              Iniciar Sincronização
            </Button>
          )}
          
          {telemetry.phase === 'success' && (
            <Button
              onClick={handleImport}
              disabled={selectedTemplates.size === 0 || isImporting}
              className="gap-1"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Importar selecionados ({selectedTemplates.size})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
