import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  LifeBuoy, 
  Copy, 
  CheckCircle2, 
  Terminal,
  ExternalLink,
  FileText,
  Bug
} from 'lucide-react';
import { useTenantRole } from '@/hooks/useTenantRole';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

export function SupportSettings() {
  const { tenantId, role, isOwner, isAdmin, isSuperAdmin } = useTenantRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const canViewLogs = isOwner || isAdmin || isSuperAdmin;

  const generateDiagnosticInfo = () => {
    const info = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      route: location.pathname,
      tenantId: tenantId || 'N/A',
      role: role || 'N/A',
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };

    return JSON.stringify(info, null, 2);
  };

  const handleCopyDiagnostic = () => {
    const info = generateDiagnosticInfo();
    navigator.clipboard.writeText(info);
    setCopied(true);
    toast.success('Diagnóstico copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Suporte e Diagnóstico</h3>
        <p className="text-sm text-muted-foreground">
          Ferramentas de ajuda e solução de problemas
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={handleCopyDiagnostic}
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copiar Diagnóstico
          </Button>

          {canViewLogs && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/diagnostics')}
            >
              <Terminal className="h-4 w-4 mr-2" />
              Ver Logs de API
              <Badge variant="secondary" className="ml-auto">Admin</Badge>
            </Button>
          )}

          {canViewLogs && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard/audit-logs')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Logs de Auditoria
              <Badge variant="secondary" className="ml-auto">Admin</Badge>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Diagnostic Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Informações de Diagnóstico
          </CardTitle>
          <CardDescription>
            Dados não sensíveis para suporte técnico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-4 rounded-lg bg-muted text-xs font-mono overflow-auto max-h-48">
            {generateDiagnosticInfo()}
          </pre>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perguntas Frequentes</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="templates">
              <AccordionTrigger className="text-sm">
                Por que meus templates não aparecem?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Templates precisam ser aprovados pela Meta antes de aparecerem na lista.
                Apenas templates com status "APPROVED" são exibidos. Verifique também se
                o Token da Meta está configurado corretamente nas configurações do canal.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="messages">
              <AccordionTrigger className="text-sm">
                Mensagens estão falhando ao enviar
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Verifique se o canal está conectado e se o número de destino está 
                formatado corretamente (com DDI + DDD). Também confirme se você está 
                dentro da janela de 24h para mensagens livres ou usando um template aprovado.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="webhooks">
              <AccordionTrigger className="text-sm">
                Não estou recebendo mensagens
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Verifique se o webhook está configurado corretamente no seu provedor.
                Use a página de Diagnóstico API para verificar o status da conexão
                e os últimos eventos recebidos.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="permissions">
              <AccordionTrigger className="text-sm">
                Não consigo acessar determinada função
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Cada função (role) tem permissões específicas. Agentes só acessam 
                Inbox e Contatos. Peça ao administrador para ajustar sua função 
                se precisar de mais acesso.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* External Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links Úteis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="link" className="h-auto p-0 text-primary" asChild>
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação WhatsApp Cloud API
            </a>
          </Button>
          <br />
          <Button variant="link" className="h-auto p-0 text-primary" asChild>
            <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Meta Business Manager
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
