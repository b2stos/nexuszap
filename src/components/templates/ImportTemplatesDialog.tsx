/**
 * ImportTemplatesDialog Component
 * 
 * Dialog para importar templates aprovados do NotificaMe
 */

import { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
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
}

interface Channel {
  id: string;
  name: string;
  phone_number: string | null;
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

  // Load channels when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      loadChannels();
    }
  }, [open, tenantId]);

  // Load templates when channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      loadTemplates();
    } else {
      setTemplates([]);
      setSelectedTemplates(new Set());
    }
  }, [selectedChannelId]);

  const loadChannels = async () => {
    setIsLoadingChannels(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('channels')
        .select('id, name, phone_number')
        .eq('tenant_id', tenantId)
        .eq('status', 'connected');

      if (queryError) throw queryError;

      setChannels(data || []);
      
      // Auto-select first channel if only one
      if (data?.length === 1) {
        setSelectedChannelId(data[0].id);
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
        setError('Nenhum template encontrado no provedor. Verifique se existem templates aprovados na sua conta NotificaMe.');
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

        // Insert template
        const { error: insertError } = await supabase
          .from('mt_templates')
          .insert({
            tenant_id: tenantId,
            provider_id: providerId,
            name: template.name,
            language: template.language || 'pt_BR',
            category: template.category || 'UTILITY',
            status: template.status === 'approved' ? 'approved' : 
                   template.status === 'rejected' ? 'rejected' : 'pending',
            components: template.components || [],
            variables_schema: null, // Will be parsed on edit
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

  const getStatusBadge = (status: string) => {
    if (status === 'approved') {
      return (
        <Badge className="bg-green-500/10 text-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Templates do NotificaMe
          </DialogTitle>
          <DialogDescription>
            Importe templates aprovados diretamente da sua conta NotificaMe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Channel Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecione o Canal</label>
            {isLoadingChannels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando canais...
              </div>
            ) : channels.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum canal conectado. Conecte um canal do NotificaMe primeiro.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um canal..." />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name} {channel.phone_number && `(${channel.phone_number})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {selectedChannelId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Templates Disponíveis
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
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Nenhum template encontrado. Verifique se o canal está configurado corretamente.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.name}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplates.has(template.name)
                            ? 'bg-primary/5 border-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleTemplate(template.name)}
                      >
                        <Checkbox
                          checked={selectedTemplates.has(template.name)}
                          onCheckedChange={() => toggleTemplate(template.name)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium font-mono text-sm truncate">
                              {template.name}
                            </span>
                            {getStatusBadge(template.status)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {template.language}
                            </Badge>
                            <Badge className={`text-xs ${getCategoryBadge(template.category)}`}>
                              {template.category}
                            </Badge>
                          </div>
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
            disabled={selectedTemplates.size === 0 || isImporting}
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
