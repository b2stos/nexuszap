/**
 * Hook for tenant-level role checking (RBAC)
 * 
 * Roles:
 * - owner: Full access to everything
 * - admin: Full access except billing/tenant deletion
 * - agent: Limited access (inbox, contacts, view-only templates/campaigns)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TenantRole = "owner" | "admin" | "agent" | null;

interface TenantContext {
  tenantId: string | null;
  tenantName: string | null;
  role: TenantRole;
  loading: boolean;
}

interface UseTenantRoleReturn extends TenantContext {
  isOwner: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  canManageTemplates: boolean;
  canManageCampaigns: boolean;
  canManageChannels: boolean;
  canViewSettings: boolean;
  canViewAuditLogs: boolean;
  canSendMessages: boolean;
  canManageContacts: boolean;
  refetch: () => Promise<void>;
}

export function useTenantRole(): UseTenantRoleReturn {
  const [context, setContext] = useState<TenantContext>({
    tenantId: null,
    tenantName: null,
    role: null,
    loading: true,
  });

  const fetchTenantRole = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setContext({ tenantId: null, tenantName: null, role: null, loading: false });
        return;
      }

      // Fetch user's tenant membership with tenant info
      const { data: membership, error } = await supabase
        .from("tenant_users")
        .select(`
          tenant_id,
          role,
          is_active,
          tenant:tenants!inner(id, name, status)
        `)
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching tenant role:", error);
        setContext({ tenantId: null, tenantName: null, role: null, loading: false });
        return;
      }

      if (!membership || !membership.tenant) {
        setContext({ tenantId: null, tenantName: null, role: null, loading: false });
        return;
      }

      // Type assertion for tenant
      const tenant = membership.tenant as { id: string; name: string; status: string };

      setContext({
        tenantId: tenant.id,
        tenantName: tenant.name,
        role: membership.role as TenantRole,
        loading: false,
      });
    } catch (err) {
      console.error("Error in useTenantRole:", err);
      setContext({ tenantId: null, tenantName: null, role: null, loading: false });
    }
  }, []);

  useEffect(() => {
    fetchTenantRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setContext({ tenantId: null, tenantName: null, role: null, loading: false });
        } else {
          fetchTenantRole();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchTenantRole]);

  // Role checks
  const isOwner = context.role === "owner";
  const isAdmin = context.role === "owner" || context.role === "admin";
  const isAgent = context.role === "agent";

  // Permission checks
  const canManageTemplates = isAdmin;
  const canManageCampaigns = isAdmin;
  const canManageChannels = isAdmin;
  const canViewSettings = isAdmin;
  const canViewAuditLogs = isAdmin;
  const canSendMessages = true; // All roles can send messages
  const canManageContacts = true; // All roles can manage contacts

  return {
    ...context,
    isOwner,
    isAdmin,
    isAgent,
    canManageTemplates,
    canManageCampaigns,
    canManageChannels,
    canViewSettings,
    canViewAuditLogs,
    canSendMessages,
    canManageContacts,
    refetch: fetchTenantRole,
  };
}
