/**
 * Hook for audit logging
 * 
 * Logs critical actions like:
 * - template.create, template.update, template.delete
 * - campaign.create, campaign.start, campaign.pause, campaign.resume
 * - channel.create, channel.update, channel.delete
 * - contact.block, contact.unblock
 * - opt_out.create, opt_out.delete
 */

import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantRole } from "./useTenantRole";

export type AuditAction = 
  | "template.create" 
  | "template.update" 
  | "template.delete"
  | "campaign.create"
  | "campaign.start"
  | "campaign.pause"
  | "campaign.resume"
  | "campaign.cancel"
  | "channel.create"
  | "channel.update"
  | "channel.delete"
  | "contact.block"
  | "contact.unblock"
  | "opt_out.create"
  | "opt_out.delete"
  | "conversation.resolve"
  | "conversation.reopen"
  | "message.send_template";

export type EntityType = 
  | "template" 
  | "campaign" 
  | "channel" 
  | "contact" 
  | "opt_out" 
  | "conversation" 
  | "message";

interface AuditLogEntry {
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

interface UseAuditLogReturn {
  logAction: (entry: AuditLogEntry) => Promise<void>;
}

export function useAuditLog(): UseAuditLogReturn {
  const { tenantId } = useTenantRole();

  const logAction = useCallback(async (entry: AuditLogEntry) => {
    if (!tenantId) {
      console.warn("[AuditLog] No tenant context, skipping log");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.warn("[AuditLog] No user session, skipping log");
        return;
      }

      // Use RPC or direct SQL for tables not yet in types
      const { error } = await supabase.rpc('log_audit_action' as never, {
        p_tenant_id: tenantId,
        p_user_id: session.user.id,
        p_action: entry.action,
        p_entity_type: entry.entity_type,
        p_entity_id: entry.entity_id || null,
        p_metadata: entry.metadata || {},
      } as never);

      // Fallback: if RPC doesn't exist, try direct insert via REST
      if (error && error.code === '42883') {
        // Function doesn't exist, use direct insert
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/audit_logs`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session.access_token}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              user_id: session.user.id,
              action: entry.action,
              entity_type: entry.entity_type,
              entity_id: entry.entity_id || null,
              metadata: entry.metadata || {},
            }),
          }
        );
        
        if (!response.ok) {
          console.error("[AuditLog] Failed to log action via REST:", await response.text());
        }
      } else if (error) {
        console.error("[AuditLog] Failed to log action:", error);
      }
    } catch (err) {
      console.error("[AuditLog] Error logging action:", err);
    }
  }, [tenantId]);

  return { logAction };
}

/**
 * Hook for fetching audit logs (admin only)
 */
export function useAuditLogs(options?: {
  entityType?: EntityType;
  entityId?: string;
  action?: string;
  limit?: number;
}) {
  const { tenantId, isAdmin } = useTenantRole();
  
  const fetchLogs = useCallback(async () => {
    if (!tenantId || !isAdmin) {
      return [];
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    // Use REST API since types may not be regenerated yet
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/audit_logs`);
    url.searchParams.set('tenant_id', `eq.${tenantId}`);
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', String(options?.limit || 100));
    
    if (options?.entityType) {
      url.searchParams.set('entity_type', `eq.${options.entityType}`);
    }
    if (options?.entityId) {
      url.searchParams.set('entity_id', `eq.${options.entityId}`);
    }
    if (options?.action) {
      url.searchParams.set('action', `eq.${options.action}`);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("[AuditLog] Failed to fetch logs:", await response.text());
        return [];
      }

      return await response.json();
    } catch (err) {
      console.error("[AuditLog] Error fetching logs:", err);
      return [];
    }
  }, [tenantId, isAdmin, options?.entityType, options?.entityId, options?.action, options?.limit]);

  return { fetchLogs };
}
