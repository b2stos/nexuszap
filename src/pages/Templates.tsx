/**
 * Templates Page
 * 
 * Página para gerenciamento de templates de WhatsApp
 * PRODUCTION: Apenas dados reais do banco
 */

import { useState, useEffect } from 'react';
import { 
  Plus, 
  FileText, 
  Loader2, 
  Pencil, 
  Trash2, 
  CheckCircle, 
  Clock, 
  XCircle,
  RefreshCw,
  Building2,
  Download,
  CloudDownload,
  Filter,
  Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TemplateBuilder, TemplateBuilderOutput } from '@/components/templates/TemplateBuilder';
import { ImportTemplatesDialog } from '@/components/templates/ImportTemplatesDialog';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCurrentTenantForTemplates,
  useTemplates,
  useDeleteTemplate,
  Template,
} from '@/hooks/useTemplates';
import { useOnboarding } from '@/hooks/useOnboarding';
import { toast } from 'sonner';
import { 
  componentsToJson, 
  variablesToSchema,
  jsonToComponents,
  TemplateComponent,
  DetectedVariable,
} from '@/utils/templateParser';

// Track onboarding when a template is created
function useTrackTemplateCreation(templatesCount: number) {
  const { state, completeStep } = useOnboarding();
  
  useEffect(() => {
    // Mark template_created step when there's at least one template
    if (templatesCount > 0 && state && !state.template_created_at) {
      completeStep('template_created');
    }
  }, [templatesCount, state?.template_created_at]);
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aprovado
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-600">
          <XCircle className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Template Builder Dialog
function TemplateBuilderDialog({
  open,
  onOpenChange,
  template,
  tenantId,
  providerId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: Template | null;
  tenantId: string;
  providerId: string;
  onSuccess: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!template;

  // Parse existing template data
  const initialComponents = template?.components 
    ? jsonToComponents(template.components) 
    : [];
  
  const initialVariables: DetectedVariable[] = template?.variables_schema
    ? [
        ...((template.variables_schema as { header?: DetectedVariable[] }).header || []).map(v => ({ ...v, section: 'HEADER' as const })),
        ...((template.variables_schema as { body?: DetectedVariable[] }).body || []).map(v => ({ ...v, section: 'BODY' as const })),
        ...((template.variables_schema as { button?: DetectedVariable[] }).button || []).map(v => ({ ...v, section: 'BUTTONS' as const })),
      ]
    : [];

  const handleSave = async (data: TemplateBuilderOutput) => {
    setIsLoading(true);

    try {
      const componentsJson = componentsToJson(data.components);
      const variablesSchema = variablesToSchema(data.variables);

      if (isEditing && template) {
        // Update existing template
        const { error } = await supabase
          .from('mt_templates')
          .update({
            name: data.name,
            language: data.language,
            category: data.category,
            status: data.status,
            components: JSON.parse(JSON.stringify(componentsJson)),
            variables_schema: JSON.parse(JSON.stringify(variablesSchema)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id)
          .eq('tenant_id', tenantId);

        if (error) throw error;
        toast.success('Template atualizado com sucesso!');
      } else {
        // Create new template
        const { error } = await supabase
          .from('mt_templates')
          .insert([{
            tenant_id: tenantId,
            provider_id: providerId,
            name: data.name,
            language: data.language,
            category: data.category,
            status: data.status,
            components: JSON.parse(JSON.stringify(componentsJson)),
            variables_schema: JSON.parse(JSON.stringify(variablesSchema)),
          }]);

        if (error) throw error;
        toast.success('Template criado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Edite os componentes e variáveis do template.'
              : 'Crie um novo template usando modelos prontos ou do zero.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <TemplateBuilder
          initialName={template?.name || ''}
          initialLanguage={template?.language || 'pt_BR'}
          initialCategory={template?.category || 'MARKETING'}
          initialStatus={template?.status || 'approved'}
          initialComponents={initialComponents}
          initialVariables={initialVariables}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          isEditing={isEditing}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('approved');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries - ALWAYS use real data
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading, refetch } = useTemplates(tenantData?.tenantId);
  const deleteTemplateMutation = useDeleteTemplate();
  
  // Track onboarding step
  useTrackTemplateCreation(templates.length);
  
  // Handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setBuilderOpen(true);
  };
  
  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setBuilderOpen(true);
  };
  
  const handleDelete = async () => {
    if (!deleteTemplate || !tenantData?.tenantId) return;
    
    await deleteTemplateMutation.mutateAsync({
      tenantId: tenantData.tenantId,
      templateId: deleteTemplate.id,
    });
    setDeleteTemplate(null);
  };

  const handleImport = () => {
    setImportOpen(true);
  };

  // Filter templates by status
  const filteredTemplates = templates.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  // Get template body preview from components
  const getBodyPreview = (template: Template): string => {
    const components = template.components as Array<{ type: string; text?: string }> | null;
    if (!components || !Array.isArray(components)) return '';
    const bodyComponent = components.find(c => c.type === 'BODY');
    return bodyComponent?.text || '';
  };
  
  // Loading state
  if (tenantLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  // No tenant state
  if (tenantError || !tenantData?.tenantId) {
    return (
      <DashboardLayout user={user}>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
          <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma organização encontrada</h2>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            Você precisa estar vinculado a uma organização para gerenciar templates.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout user={user}>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-muted-foreground">
              Gerencie seus templates de mensagem do WhatsApp
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={templatesLoading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button 
              variant="default" 
              onClick={handleImport}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <CloudDownload className="h-4 w-4 mr-2" />
              Sincronizar da Meta
            </Button>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-4 w-4" />
            Filtrar:
          </span>
          <div className="flex gap-1">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos ({templates.length})
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
              className={statusFilter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Aprovados ({templates.filter(t => t.status === 'approved').length})
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className={statusFilter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              <Clock className="h-3 w-3 mr-1" />
              Pendentes ({templates.filter(t => t.status === 'pending').length})
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
              className={statusFilter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Rejeitados ({templates.filter(t => t.status === 'rejected').length})
            </Button>
          </div>
        </div>
        
        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Templates Cadastrados
            </CardTitle>
            <CardDescription>
              Templates precisam estar aprovados pelo WhatsApp para serem usados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">Nenhum template cadastrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sincronize templates aprovados da sua conta WhatsApp Business (Meta) para usar no Inbox e campanhas.
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                    <CloudDownload className="h-4 w-4 mr-2" />
                    Sincronizar Templates da Meta
                  </Button>
                  <Button variant="outline" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Manualmente
                  </Button>
                </div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">Nenhum template com status "{statusFilter}"</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Altere o filtro para ver outros templates.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
                  Mostrar todos
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Variáveis</TableHead>
                    <TableHead className="hidden lg:table-cell">Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => {
                    const varsSchema = template.variables_schema as { 
                      header?: unknown[]; 
                      body?: unknown[]; 
                      button?: unknown[] 
                    } | null;
                    const varsCount = varsSchema
                      ? (varsSchema.header?.length || 0) + 
                        (varsSchema.body?.length || 0) + 
                        (varsSchema.button?.length || 0)
                      : 0;
                    const bodyPreview = getBodyPreview(template);
                    
                    return (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium font-mono text-sm">{template.name}</span>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">{template.language}</Badge>
                              <Badge variant="outline" className="text-xs">{template.category}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[300px]">
                          {bodyPreview ? (
                            <div className="relative group">
                              <p className="text-sm text-muted-foreground truncate">
                                {bodyPreview.substring(0, 80)}{bodyPreview.length > 80 ? '...' : ''}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setPreviewTemplate(template)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem preview</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={template.status} />
                            {template.rejection_reason && template.status === 'rejected' && (
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={template.rejection_reason}>
                                {template.rejection_reason.substring(0, 30)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {varsCount > 0 ? (
                            <Badge variant="secondary" className="text-xs">{varsCount} var</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                          {format(new Date(template.created_at), "dd/MM/yy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPreviewTemplate(template)}
                              title="Ver preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(template)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTemplate(template)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        {/* Template Builder Dialog */}
        {tenantData?.providerId && (
          <TemplateBuilderDialog
            open={builderOpen}
            onOpenChange={setBuilderOpen}
            template={editingTemplate}
            tenantId={tenantData.tenantId}
            providerId={tenantData.providerId}
            onSuccess={() => refetch()}
          />
        )}

        {/* Import Dialog */}
        {tenantData?.providerId && (
          <ImportTemplatesDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            tenantId={tenantData.tenantId}
            providerId={tenantData.providerId}
            onImportComplete={() => refetch()}
          />
        )}

        {/* Template Preview Dialog */}
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview: {previewTemplate?.name}
              </DialogTitle>
              <DialogDescription>
                Visualização do conteúdo do template
              </DialogDescription>
            </DialogHeader>
            {previewTemplate && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={previewTemplate.status} />
                  <Badge variant="outline">{previewTemplate.language}</Badge>
                  <Badge variant="outline">{previewTemplate.category}</Badge>
                </div>
                
                {/* Render components */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  {(previewTemplate.components as Array<{ type: string; format?: string; text?: string; buttons?: Array<{ type: string; text: string }> }> || []).map((component, idx) => (
                    <div key={idx} className="text-sm">
                      {component.type === 'HEADER' && component.text && (
                        <div className="font-semibold text-base">{component.text}</div>
                      )}
                      {component.type === 'HEADER' && component.format === 'IMAGE' && (
                        <div className="text-muted-foreground italic">[Imagem do header]</div>
                      )}
                      {component.type === 'BODY' && component.text && (
                        <div className="whitespace-pre-wrap">{component.text}</div>
                      )}
                      {component.type === 'FOOTER' && component.text && (
                        <div className="text-xs text-muted-foreground mt-2">{component.text}</div>
                      )}
                      {component.type === 'BUTTONS' && component.buttons && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {component.buttons.map((btn, btnIdx) => (
                            <Badge key={btnIdx} variant="secondary">
                              {btn.text}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Variables info */}
                {(() => {
                  const varsSchema = previewTemplate.variables_schema as { 
                    header?: unknown[]; 
                    body?: unknown[]; 
                    button?: unknown[] 
                  } | null;
                  const varsCount = varsSchema
                    ? (varsSchema.header?.length || 0) + 
                      (varsSchema.body?.length || 0) + 
                      (varsSchema.button?.length || 0)
                    : 0;
                  
                  if (varsCount > 0) {
                    return (
                      <div className="text-sm text-muted-foreground">
                        <strong>{varsCount}</strong> variável(is) detectada(s)
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir template?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o template "{deleteTemplate?.name}"?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                {deleteTemplateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
