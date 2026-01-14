/**
 * CampaignDebugPanel - Painel de Debug para Campanhas
 * 
 * Mostra informações detalhadas da última tentativa de envio:
 * - Endpoint chamado
 * - Status code
 * - Response raw
 * - TraceId
 * - Erro JS serializado
 * - Payload resumido
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Server,
  FileJson,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

export interface DebugInfo {
  timestamp: string;
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  responseRaw?: string;
  traceId?: string;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  errorCause?: unknown;
  payloadSummary?: Record<string, unknown>;
  durationMs?: number;
}

interface CampaignDebugPanelProps {
  debugInfo: DebugInfo | null;
  className?: string;
}

export function CampaignDebugPanel({ debugInfo, className = "" }: CampaignDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!debugInfo) {
    return null;
  }

  const handleCopyDetails = () => {
    const details = {
      timestamp: debugInfo.timestamp,
      endpoint: debugInfo.endpoint,
      method: debugInfo.method,
      status: debugInfo.status,
      statusText: debugInfo.statusText,
      traceId: debugInfo.traceId,
      error: debugInfo.errorMessage,
      errorName: debugInfo.errorName,
      responsePreview: debugInfo.responseRaw?.slice(0, 500),
      durationMs: debugInfo.durationMs,
    };

    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopied(true);
    toast.success("Detalhes copiados para a área de transferência");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasError = debugInfo.errorMessage || (debugInfo.status && debugInfo.status >= 400);
  const isSuccess = debugInfo.status && debugInfo.status >= 200 && debugInfo.status < 300;

  const getStatusBadge = () => {
    if (!debugInfo.status) {
      return <Badge variant="outline" className="bg-gray-100">Sem resposta</Badge>;
    }
    if (debugInfo.status >= 200 && debugInfo.status < 300) {
      return <Badge className="bg-green-500 text-white">{debugInfo.status} OK</Badge>;
    }
    if (debugInfo.status >= 400 && debugInfo.status < 500) {
      return <Badge className="bg-orange-500 text-white">{debugInfo.status} Client Error</Badge>;
    }
    if (debugInfo.status >= 500) {
      return <Badge className="bg-red-500 text-white">{debugInfo.status} Server Error</Badge>;
    }
    return <Badge variant="outline">{debugInfo.status}</Badge>;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <Card className={`border-dashed ${hasError ? 'border-red-300' : isSuccess ? 'border-green-300' : 'border-muted'}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Debug do Disparo</CardTitle>
                {debugInfo.traceId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Trace: {debugInfo.traceId.slice(0, 8)}...
                  </Badge>
                )}
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2">
                {debugInfo.durationMs && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {debugInfo.durationMs}ms
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Botão Copiar */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDetails}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copiar Detalhes
                  </>
                )}
              </Button>
            </div>

            {/* Informações Básicas */}
            <div className="grid gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Server className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Endpoint</p>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded break-all">
                    {debugInfo.method} {debugInfo.endpoint}
                  </code>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Timestamp</p>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                    {debugInfo.timestamp}
                  </code>
                </div>
              </div>

              {debugInfo.traceId && (
                <div className="flex items-start gap-2">
                  <FileJson className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Trace ID</p>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {debugInfo.traceId}
                    </code>
                  </div>
                </div>
              )}
            </div>

            {/* Erro */}
            {(debugInfo.errorMessage || debugInfo.errorName) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium text-sm">Erro Capturado</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-2">
                  {debugInfo.errorName && (
                    <p className="text-sm">
                      <span className="font-medium">Nome:</span>{" "}
                      <code className="bg-red-100 dark:bg-red-800 px-1 rounded">{debugInfo.errorName}</code>
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">Mensagem:</span>{" "}
                    <span className="text-red-700 dark:text-red-300">{debugInfo.errorMessage}</span>
                  </p>
                  {debugInfo.errorCause && (
                    <div>
                      <span className="font-medium text-sm">Causa:</span>
                      <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto max-h-[100px]">
                        {JSON.stringify(debugInfo.errorCause, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Response Raw */}
            {debugInfo.responseRaw && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Response Raw (primeiros 2000 chars)</p>
                <ScrollArea className="h-[150px] w-full rounded-md border bg-muted/50 p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {debugInfo.responseRaw.slice(0, 2000)}
                    {debugInfo.responseRaw.length > 2000 && '...'}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {/* Payload Resumido */}
            {debugInfo.payloadSummary && Object.keys(debugInfo.payloadSummary).length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Payload Resumido</p>
                <ScrollArea className="h-[100px] w-full rounded-md border bg-muted/50 p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.payloadSummary, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}

            {/* Stack Trace */}
            {debugInfo.errorStack && (
              <div className="space-y-2">
                <p className="font-medium text-sm">Stack Trace</p>
                <ScrollArea className="h-[100px] w-full rounded-md border bg-muted/50 p-3">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-red-600 dark:text-red-400">
                    {debugInfo.errorStack}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
