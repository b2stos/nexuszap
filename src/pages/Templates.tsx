/**
 * Templates Page
 * 
 * Página para gerenciamento de templates de WhatsApp
 * APENAS templates sincronizados do Meta (WABA) são exibidos
 * Criação/edição local foi removida - só sync
 */

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Loader2, 
  CheckCircle, 
  Clock, 
  XCircle,
  RefreshCw,
  Building2,
  CloudDownload,
  Filter,
  Eye,
  Cloud,
  AlertTriangle,
  Info,
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
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ImportTemplatesDialog } from '@/components/templates/ImportTemplatesDialog';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCurrentTenantForTemplates,
  useTemplates,
  Template,
} from '@/hooks/useTemplates';
import { useOnboarding } from '@/hooks/useOnboarding';

// Track onboarding when a template is synced
function useTrackTemplateSync(templatesCount: number) {
  const { state, completeStep } = useOnboarding();
  
  useEffect(() => {
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
        <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">
          <XCircle className="w-3 h-3 mr-1" />
          Rejeitado
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Source badge component
function SourceBadge({ source }: { source?: string }) {
  if (source === 'meta') {
    return (
      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">
        <Cloud className="w-3 h-3 mr-1" />
        Meta
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-200">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Local
    </Badge>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('approved');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries - ONLY Meta templates
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading, refetch } = useTemplates(tenantData?.tenantId);
  
  // Track onboarding step
  useTrackTemplateSync(templates.length);
  
  // Handlers
  const handleImport = () => {
    setImportOpen(true);
  };

  // Filter templates by status (only show meta source)
  const metaTemplates = templates.filter(t => {
    const source = (t as any).source;
    return source === 'meta' || source === undefined; // Include old templates without source column
  });
  
  const filteredTemplates = metaTemplates.filter(t => {
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
              Templates sincronizados da sua conta WhatsApp Business (Meta)
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
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Templates são gerenciados diretamente no Meta Business Suite. 
            Use o botão "Sincronizar da Meta" para importar templates aprovados para uso em campanhas e no Inbox.
          </AlertDescription>
        </Alert>

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
              Todos ({metaTemplates.length})
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
              className={statusFilter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Aprovados ({metaTemplates.filter(t => t.status === 'approved').length})
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
              className={statusFilter === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              <Clock className="h-3 w-3 mr-1" />
              Pendentes ({metaTemplates.filter(t => t.status === 'pending').length})
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
              className={statusFilter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Rejeitados ({metaTemplates.filter(t => t.status === 'rejected').length})
            </Button>
          </div>
        </div>
        
        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Templates Sincronizados
            </CardTitle>
            <CardDescription>
              Templates precisam estar aprovados pelo WhatsApp para serem usados em campanhas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : metaTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CloudDownload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">Nenhum template sincronizado</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Clique em "Sincronizar da Meta" para importar templates aprovados da sua conta WhatsApp Business.
                </p>
                <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                  <CloudDownload className="h-4 w-4 mr-2" />
                  Sincronizar Templates da Meta
                </Button>
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
                    <TableHead className="hidden lg:table-cell">Sincronizado</TableHead>
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
                    const lastSynced = (template as any).last_synced_at;
                    
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
                          {lastSynced 
                            ? format(new Date(lastSynced), "dd/MM/yy HH:mm", { locale: ptBR })
                            : format(new Date(template.created_at), "dd/MM/yy", { locale: ptBR })
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPreviewTemplate(template)}
                            title="Ver preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                <div className="flex items-center gap-2 flex-wrap">
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
                    header?: Array<{ key: string; label: string }>; 
                    body?: Array<{ key: string; label: string }>; 
                    button?: Array<{ key: string; label: string }> 
                  } | null;
                  const allVars = [
                    ...(varsSchema?.header || []),
                    ...(varsSchema?.body || []),
                    ...(varsSchema?.button || []),
                  ];
                  
                  if (allVars.length === 0) return null;
                  
                  return (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-2">Variáveis ({allVars.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {allVars.map((v, idx) => (
                          <Badge key={idx} variant="outline" className="font-mono text-xs">
                            {`{{${v.key}}}`} - {v.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
