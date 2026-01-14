/**
 * ImportTemplatesDialog Component
 * 
 * Dialog para importar templates aprovados diretamente da API oficial da Meta (WhatsApp Business Platform).
 * 
 * IMPORTANTE:
 * - Templates pertencem à Meta, NÃO ao NotificaMe
 * - O canal precisa ter WABA_ID configurado
 * - Apenas templates com status APPROVED são listados
 */

import { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle, RefreshCw, Info } from 'lucide-react';
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

type TemplateSource = 'notificame' | 'meta' | 'none';

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
  } | null;
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
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const hasWabaId = !!selectedChannel?.provider_config?.waba_id;

  // Load channels when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      loadChannels();
    }
  }, [open, tenantId]);

  // Load templates when channel is selected
  useEffect(() => {
    if (selectedChannelId && hasWabaId) {
      loadTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplates(new Set());
    }
  }, [selectedChannelId, hasWabaId]);

  const loadChannels = async () => {
    setIsLoadingChannels(true);
    setError(null);

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
        (c: Channel) => c.provider_config?.waba_id
      );
      if (channelsWithWaba.length === 1) {
        setSelectedChannelId(channelsWithWaba[0].id);
      }
    } catch (err) {
      console.error('Error loading channels:', err);
      setError('Erro ao carregar canais');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const loadTemplates = async () => {
    if (!selectedChannelId) return;

    setIsLoadingTemplates(true);
    setError(null);
    setTemplates([]);
    setSelectedTemplates(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await supabase.functions.invoke('list-notificame-templates', {
        body: { channel_id: selectedChannelId },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao buscar templates');
      }

      const result = response.data;

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar templates');
      }

      setTemplates(result.templates || []);

      if (result.templates?.length === 0) {
        setError('Nenhum template aprovado encontrado na conta WhatsApp Business. Certifique-se de ter templates com status "APPROVED" na Meta.');
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar templates');
    } finally {
      setIsLoadingTemplates(false);
    }
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
    setError(null);

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

        // Insert template
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
      setError(err instanceof Error ? err.message : 'Erro ao importar templates');
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
                          {!channel.provider_config?.waba_id && (
                            <Badge variant="outline" className="text-xs text-yellow-600">
                              Sem WABA_ID
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* WABA ID Warning */}
                {selectedChannelId && !hasWabaId && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Este canal não possui WABA_ID configurado. 
                      Edite o canal e adicione o ID da conta WhatsApp Business para importar templates.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Templates List */}
          {selectedChannelId && hasWabaId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Templates Aprovados
                  {templates.length > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({selectedTemplates.size}/{templates.length} selecionados)
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  {templates.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={selectAll}>
                      {selectedTemplates.size === templates.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadTemplates}
                    disabled={isLoadingTemplates}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>

              {isLoadingTemplates ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Buscando templates na API da Meta...
                  </span>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Nenhum template aprovado encontrado.
                  </p>
                  <p className="text-xs mt-1">
                    Verifique se existem templates com status APPROVED na sua conta WhatsApp Business.
                  </p>
                </div>
              ) : (
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
            disabled={selectedTemplates.size === 0 || isImporting || !hasWabaId}
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
