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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <p className="text-muted-foreground">
              Gerencie seus templates de mensagem do WhatsApp
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              disabled={templatesLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={handleImport}>
              <Download className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
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
                  Cadastre seus templates aprovados pelo WhatsApp para usar no Inbox e campanhas.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleImport}>
                    <Download className="h-4 w-4 mr-2" />
                    Importar do NotificaMe
                  </Button>
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Template
                  </Button>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variáveis</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => {
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
                    
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium font-mono">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.language}</Badge>
                        </TableCell>
                        <TableCell>{template.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={template.status} />
                            {template.rejection_reason && template.status === 'rejected' && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={template.rejection_reason}>
                                {template.rejection_reason.substring(0, 50)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {varsCount > 0 ? (
                            <span className="text-sm">{varsCount} variável(is)</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nenhuma</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(template.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(template)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTemplate(template)}
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
