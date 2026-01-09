/**
 * Audit Logs Panel
 * 
 * Displays audit trail for critical actions (admin only)
 */

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  Loader2, 
  RefreshCw, 
  FileText, 
  Send, 
  Phone, 
  Users, 
  MessageSquare,
  Filter,
  ShieldAlert
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenantRole } from "@/hooks/useTenantRole";
import { EntityType, AuditAction } from "@/hooks/useAuditLog";

interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  "template.create": "Template criado",
  "template.update": "Template atualizado",
  "template.delete": "Template excluído",
  "campaign.create": "Campanha criada",
  "campaign.start": "Campanha iniciada",
  "campaign.pause": "Campanha pausada",
  "campaign.resume": "Campanha retomada",
  "campaign.cancel": "Campanha cancelada",
  "channel.create": "Canal criado",
  "channel.update": "Canal atualizado",
  "channel.delete": "Canal excluído",
  "contact.block": "Contato bloqueado",
  "contact.unblock": "Contato desbloqueado",
  "opt_out.create": "Opt-out adicionado",
  "opt_out.delete": "Opt-out removido",
  "conversation.resolve": "Conversa resolvida",
  "conversation.reopen": "Conversa reaberta",
  "message.send_template": "Template enviado",
  "user.deactivate": "Usuário desativado",
  "user.reactivate": "Usuário reativado",
};

const entityIcons: Record<EntityType, React.ReactNode> = {
  template: <FileText className="h-4 w-4" />,
  campaign: <Send className="h-4 w-4" />,
  channel: <Phone className="h-4 w-4" />,
  contact: <Users className="h-4 w-4" />,
  opt_out: <ShieldAlert className="h-4 w-4" />,
  conversation: <MessageSquare className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  user: <Users className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-600",
  update: "bg-blue-500/10 text-blue-600",
  delete: "bg-red-500/10 text-red-600",
  start: "bg-green-500/10 text-green-600",
  pause: "bg-yellow-500/10 text-yellow-600",
  resume: "bg-green-500/10 text-green-600",
  cancel: "bg-red-500/10 text-red-600",
  block: "bg-red-500/10 text-red-600",
  unblock: "bg-green-500/10 text-green-600",
  resolve: "bg-blue-500/10 text-blue-600",
  reopen: "bg-yellow-500/10 text-yellow-600",
  send_template: "bg-blue-500/10 text-blue-600",
};

export function AuditLogsPanel() {
  const { tenantId, isAdmin, loading: roleLoading } = useTenantRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    if (!tenantId || !isAdmin) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching audit logs:", error);
        setLogs([]);
      } else {
        setLogs((data || []) as AuditLog[]);
      }
    } catch (err) {
      console.error("Error in fetchLogs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isAdmin, entityFilter]);

  useEffect(() => {
    if (!roleLoading) {
      fetchLogs();
    }
  }, [fetchLogs, roleLoading]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!tenantId || !isAdmin) return;

    const channel = supabase
      .channel("audit-logs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLog, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, isAdmin]);

  if (!isAdmin) {
    return null;
  }

  const getActionType = (action: string): string => {
    const parts = action.split(".");
    return parts[parts.length - 1] || "unknown";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle>Registro de Atividades</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="template">Templates</SelectItem>
                <SelectItem value="campaign">Campanhas</SelectItem>
                <SelectItem value="channel">Canais</SelectItem>
                <SelectItem value="contact">Contatos</SelectItem>
                <SelectItem value="conversation">Conversas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Trilha de auditoria das ações críticas realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma atividade registrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {logs.map((log) => {
                const actionType = getActionType(log.action);
                const colorClass = actionColors[actionType] || "bg-muted text-muted-foreground";

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1 text-muted-foreground">
                      {entityIcons[log.entity_type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={colorClass}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        {log.entity_id && (
                          <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {log.entity_id.slice(0, 8)}...
                          </code>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {JSON.stringify(log.metadata).slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
