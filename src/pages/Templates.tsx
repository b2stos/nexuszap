/**
 * Templates Page
 * 
 * Página para gerenciamento de templates de WhatsApp
 * Exibe TODOS os templates sincronizados do Meta (WABA) - não apenas aprovados
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
  AlertTriangle,
  Info,
  PauseCircle,
  MinusCircle,
  Flag,
  Scale,
  HelpCircle,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ImportTemplatesDialog } from '@/components/templates/ImportTemplatesDialog';
import { TemplatesErrorBoundary } from '@/components/templates/TemplatesErrorBoundary';
import { MetaAccountInfo } from '@/components/templates/MetaAccountInfo';
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
import { useQuery } from '@tanstack/react-query';
import {
  dbStatusToCanonical,
  getStatusLabel,
  getStatusColorClasses,
  matchesFilterCategory,
  STATUS_FILTER_LABELS,
  type StatusFilterCategory,
  type CanonicalTemplateStatus,
} from '@/utils/templateStatusMapper';

// Hook to get channel with Meta config
function useChannelMetaConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['channel-meta-config', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, phone_number, provider_config')
        .eq('tenant_id', tenantId)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

// Get icon for status
function getStatusIcon(canonicalStatus: CanonicalTemplateStatus) {
  const iconMap: Record<CanonicalTemplateStatus, React.ReactNode> = {
    'APPROVED': <CheckCircle className="w-3 h-3 mr-1" />,
    'IN_REVIEW': <Clock className="w-3 h-3 mr-1" />,
    'REJECTED': <XCircle className="w-3 h-3 mr-1" />,
    'PAUSED': <PauseCircle className="w-3 h-3 mr-1" />,
    'DISABLED': <MinusCircle className="w-3 h-3 mr-1" />,
    'IN_APPEAL': <Scale className="w-3 h-3 mr-1" />,
    'FLAGGED': <Flag className="w-3 h-3 mr-1" />,
    'UNKNOWN': <HelpCircle className="w-3 h-3 mr-1" />,
  };
  return iconMap[canonicalStatus] || <HelpCircle className="w-3 h-3 mr-1" />;
}

// Status badge component - suporta todos os status
function StatusBadge({ status }: { status: string }) {
  const canonical = dbStatusToCanonical(status);
  const label = getStatusLabel(status);
  const colors = getStatusColorClasses(status);
  
  return (
    <Badge className={`${colors.bg} ${colors.text} ${colors.hover}`}>
      {getStatusIcon(canonical)}
      {label}
    </Badge>
  );
}

// Count templates by filter category
function countByCategory(templates: Template[], category: StatusFilterCategory): number {
  if (category === 'all') return templates.length;
  return templates.filter(t => matchesFilterCategory(t.status, category)).length;
}

// Get tooltip message for CTA button based on status
function getCtaTooltip(canonicalStatus: CanonicalTemplateStatus): string | null {
  const tooltipMap: Record<CanonicalTemplateStatus, string | null> = {
    'APPROVED': null, // No tooltip needed - button is enabled
    'IN_REVIEW': 'Em análise na Meta — aguarde aprovação',
    'REJECTED': 'Reprovado — ajuste e reenvie na Meta',
    'PAUSED': 'Template pausado — reative na Meta',
    'DISABLED': 'Template desativado pela Meta',
    'IN_APPEAL': 'Em recurso — aguarde análise',
    'FLAGGED': 'Template sinalizado — verifique na Meta',
    'UNKNOWN': 'Status desconhecido — sincronize novamente',
  };
  return tooltipMap[canonicalStatus];
}

// Check if template status allows usage
function isTemplateUsable(canonicalStatus: CanonicalTemplateStatus): boolean {
  return canonicalStatus === 'APPROVED';
}

// Main content component (wrapped by error boundary)
function TemplatesContent() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilterCategory>('all');
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  
  // Delete mutation
  const deleteTemplate = useDeleteTemplate();
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries - ALL Meta templates
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading, refetch, error: templatesError } = useTemplates(tenantData?.tenantId);
  const { data: channelConfig } = useChannelMetaConfig(tenantData?.tenantId);
  
  // Handlers
  const handleImport = () => {
    setImportOpen(true);
  };

  // Revalidate individual template status from Meta API
  const handleRevalidateTemplate = async (templateId: string) => {
    setRevalidatingId(templateId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada');
      }

      const response = await supabase.functions.invoke('revalidate-template-status', {
        body: { template_id: templateId },
      });

      if (response.error) {
        throw response.error;
      }

      const result = response.data;
      
      if (!result.ok && result.error) {
        console.error('Revalidation error:', result.error);
        // Still refetch to show updated data
      }

      // Refetch templates to show updated status
      await refetch();
      
      // Show feedback based on result
      if (result.mismatch) {
        console.log(`Template status updated: ${result.previous_status} → ${result.status}`);
      }
    } catch (error) {
      console.error('Error revalidating template:', error);
    } finally {
      setRevalidatingId(null);
    }
  };

  // Handle delete template
  const handleDeleteTemplate = () => {
    if (!templateToDelete || !tenantData?.tenantId) return;
    
    deleteTemplate.mutate(
      { tenantId: tenantData.tenantId, templateId: templateToDelete.id },
      { onSettled: () => setTemplateToDelete(null) }
    );
  };

  // Safely filter templates with null checks
  const safeTemplates = Array.isArray(templates) ? templates : [];
  
  // Filter templates by source (only show meta source)
  const metaTemplates = safeTemplates.filter(t => {
    if (!t) return false;
    const source = (t as { source?: string }).source;
    return source === 'meta' || source === undefined;
  });
  
  // Filter by status category
  const filteredTemplates = metaTemplates.filter(t => {
    if (statusFilter === 'all') return true;
    return matchesFilterCategory(t.status, statusFilter);
  });

  // Count by category for badges
  const approvedCount = countByCategory(metaTemplates, 'approved');
  const inReviewCount = countByCategory(metaTemplates, 'in_review');
  const rejectedCount = countByCategory(metaTemplates, 'rejected');
  const pausedDisabledCount = countByCategory(metaTemplates, 'paused_disabled');

  // Get template body preview from components
  const getBodyPreview = (template: Template): string => {
    if (!template) return '';
    const components = template.components as Array<{ type: string; text?: string }> | null;
    if (!components || !Array.isArray(components)) return '';
    const bodyComponent = components.find(c => c?.type === 'BODY');
    return bodyComponent?.text || '';
  };

  // Extract Meta config from channel
  const providerConfig = channelConfig?.provider_config as {
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
  } | null;
  
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

  // Error state for templates
  if (templatesError) {
    return (
      <DashboardLayout user={user}>
        <div className="container py-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">Erro ao carregar templates</p>
              <p className="text-sm">{templatesError instanceof Error ? templatesError.message : 'Erro desconhecido'}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
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

        {/* Meta Account Info */}
        {channelConfig && (
          <MetaAccountInfo
            wabaId={providerConfig?.waba_id}
            phoneNumberId={providerConfig?.phone_number_id}
            businessId={providerConfig?.business_id}
            channelId={channelConfig.id}
            channelName={channelConfig.name}
          />
        )}

        {/* Last Sync Info + Help Alert */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Alert className="flex-1">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Templates são gerenciados diretamente no Meta Business Suite. 
              Apenas templates aprovados podem ser usados em campanhas.
            </AlertDescription>
          </Alert>
          
          {/* Last sync timestamp */}
          {metaTemplates.length > 0 && (() => {
            const latestSync = metaTemplates.reduce((latest, t) => {
              const syncDate = (t as { last_synced_at?: string }).last_synced_at;
              if (!syncDate) return latest;
              return !latest || new Date(syncDate) > new Date(latest) ? syncDate : latest;
            }, null as string | null);
            
            if (!latestSync) return null;
            
            return (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                <RefreshCw className="h-4 w-4" />
                <span>
                  Última sincronização:{' '}
                  <span className="font-medium">
                    {format(new Date(latestSync), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </span>
              </div>
            );
          })()}
        </div>

        {/* Warning if no approved templates */}
        {metaTemplates.length > 0 && approvedCount === 0 && (
          <Alert className="bg-yellow-500/10 border-yellow-500/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <span className="font-medium">Sem templates aprovados no momento.</span> 
              {' '}Templates precisam ser aprovados pela Meta para serem usados em campanhas.
            </AlertDescription>
          </Alert>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Filter className="h-4 w-4" />
            Filtrar:
          </span>
          <div className="flex gap-1 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              {STATUS_FILTER_LABELS.all} ({metaTemplates.length})
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
              className={statusFilter === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {STATUS_FILTER_LABELS.approved} ({approvedCount})
            </Button>
            <Button
              variant={statusFilter === 'in_review' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('in_review')}
              className={statusFilter === 'in_review' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              <Clock className="h-3 w-3 mr-1" />
              {STATUS_FILTER_LABELS.in_review} ({inReviewCount})
            </Button>
            <Button
              variant={statusFilter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('rejected')}
              className={statusFilter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              <XCircle className="h-3 w-3 mr-1" />
              {STATUS_FILTER_LABELS.rejected} ({rejectedCount})
            </Button>
            <Button
              variant={statusFilter === 'paused_disabled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('paused_disabled')}
              className={statusFilter === 'paused_disabled' ? 'bg-gray-600 hover:bg-gray-700' : ''}
            >
              <PauseCircle className="h-3 w-3 mr-1" />
              {STATUS_FILTER_LABELS.paused_disabled} ({pausedDisabledCount})
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
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : metaTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CloudDownload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">Nenhum template encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Clique em "Sincronizar da Meta" para importar templates da sua conta WhatsApp Business.
                </p>
                <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                  <CloudDownload className="h-4 w-4 mr-2" />
                  Sincronizar Templates da Meta
                </Button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">
                  Nenhum template com status "{STATUS_FILTER_LABELS[statusFilter]}"
                </h3>
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
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => {
                    if (!template) return null;
                    
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
                    const lastSynced = (template as { last_synced_at?: string }).last_synced_at;
                    
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
                          <div className="flex items-center justify-end gap-2">
                            {/* Revalidate button */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={revalidatingId === template.id}
                                    onClick={() => handleRevalidateTemplate(template.id)}
                                  >
                                    <RefreshCw className={`h-4 w-4 ${revalidatingId === template.id ? 'animate-spin' : ''}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Revalidar status na Meta</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Delete button */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={deleteTemplate.isPending}
                                    onClick={() => setTemplateToDelete(template)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Excluir template</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* CTA button */}
                            {(() => {
                              const canonical = dbStatusToCanonical(template.status);
                              const isUsable = isTemplateUsable(canonical);
                              const tooltip = getCtaTooltip(canonical);
                              
                              const ctaButton = (
                                <Button
                                  variant={isUsable ? "default" : "outline"}
                                  size="sm"
                                  className={isUsable 
                                    ? "bg-primary hover:bg-primary/90" 
                                    : "opacity-50 cursor-not-allowed"
                                  }
                                  disabled={!isUsable}
                                  onClick={() => {
                                    if (isUsable) {
                                      navigate(`/dashboard/campaigns/new?templateId=${template.id}`);
                                    }
                                  }}
                                >
                                  Prosseguir
                                  <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                              );
                              
                              if (tooltip) {
                                return (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block">{ctaButton}</span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{tooltip}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                );
                              }
                              
                              return ctaButton;
                            })()}
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir template?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Você está prestes a excluir o template{' '}
                  <span className="font-semibold font-mono">"{templateToDelete?.name}"</span>.
                </p>
                <p className="text-muted-foreground">
                  Esta ação remove o template apenas do Nexus Zap. O template continuará existindo na sua conta Meta/WABA.
                  Se você sincronizar novamente, ele voltará a aparecer.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteTemplate.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTemplate}
                disabled={deleteTemplate.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteTemplate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

// Main export with Error Boundary wrapper
export default function Templates() {
  return (
    <TemplatesErrorBoundary onReset={() => window.location.reload()}>
      <TemplatesContent />
    </TemplatesErrorBoundary>
  );
}
