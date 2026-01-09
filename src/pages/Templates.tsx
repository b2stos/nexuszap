/**
 * Templates Page
 * 
 * Página para gerenciamento de templates de WhatsApp
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
  Lightbulb,
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
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCurrentTenantForTemplates,
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  Template,
  CreateTemplateInput,
  TemplateVariablesSchema,
} from '@/hooks/useTemplates';
import { useOnboarding } from '@/hooks/useOnboarding';

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

// Template form dialog
function TemplateFormDialog({
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
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState('MARKETING');
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [variablesJson, setVariablesJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  
  const isEditing = !!template;
  const isLoading = createTemplate.isPending || updateTemplate.isPending;
  
  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setLanguage(template.language);
        setCategory(template.category);
        setStatus(template.status);
        setVariablesJson(
          template.variables_schema 
            ? JSON.stringify(template.variables_schema, null, 2) 
            : ''
        );
      } else {
        setName('');
        setLanguage('pt_BR');
        setCategory('MARKETING');
        setStatus('approved');
        setVariablesJson('');
      }
      setJsonError('');
    }
  }, [open, template]);
  
  const handleSubmit = async () => {
    // Validate JSON
    let parsedVariables: TemplateVariablesSchema | undefined;
    if (variablesJson.trim()) {
      try {
        parsedVariables = JSON.parse(variablesJson);
        setJsonError('');
      } catch (e) {
        setJsonError('JSON inválido');
        return;
      }
    }
    
    const input: CreateTemplateInput = {
      name,
      language,
      category,
      status,
      variables_schema: parsedVariables,
    };
    
    try {
      if (isEditing) {
        await updateTemplate.mutateAsync({
          tenantId,
          input: { id: template.id, ...input },
        });
      } else {
        await createTemplate.mutateAsync({
          tenantId,
          providerId,
          input,
        });
      }
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Atualize as informações do template.'
              : 'Cadastre um template aprovado pelo WhatsApp.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do Template</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="hello_world"
            />
            <p className="text-xs text-muted-foreground">
              Use o mesmo nome cadastrado no WhatsApp Business
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="language">Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utilitário</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Marque como "Aprovado" se já foi aprovado pelo WhatsApp
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="variables">Variáveis (JSON)</Label>
            <Textarea
              id="variables"
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              placeholder={`{
  "body": [
    {"key": "nome", "label": "Nome", "required": true},
    {"key": "produto", "label": "Produto", "required": false}
  ]
}`}
              className="font-mono text-sm h-32"
            />
            {jsonError && (
              <p className="text-xs text-destructive">{jsonError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Defina as variáveis do template (header, body, button)
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null);
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading, refetch } = useTemplates(tenantData?.tenantId);
  const deleteTemplateMutation = useDeleteTemplate();
  
  // Track onboarding step
  useTrackTemplateCreation(templates.length);
  
  // Handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };
  
  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };
  
  const handleDelete = async () => {
    if (!deleteTemplate || !tenantData?.tenantId) return;
    
    await deleteTemplateMutation.mutateAsync({
      tenantId: tenantData.tenantId,
      templateId: deleteTemplate.id,
    });
    setDeleteTemplate(null);
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
          <Button onClick={() => navigate('/dashboard')}>
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
            <Button variant="outline" onClick={() => refetch()} disabled={templatesLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${templatesLoading ? 'animate-spin' : ''}`} />
              Atualizar
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
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro template
                </Button>
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
                    const varsCount = template.variables_schema
                      ? Object.values(template.variables_schema).flat().length
                      : 0;
                    
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.language}</Badge>
                        </TableCell>
                        <TableCell>{template.category}</TableCell>
                        <TableCell>
                          <StatusBadge status={template.status} />
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
        
        {/* Form Dialog */}
        {tenantData?.providerId && (
          <TemplateFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            template={editingTemplate}
            tenantId={tenantData.tenantId}
            providerId={tenantData.providerId}
            onSuccess={() => refetch()}
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
