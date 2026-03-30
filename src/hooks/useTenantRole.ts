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

export type TenantRole = "owner" | "admin" | "manager" | "agent" | null;

interface TenantContext {
  tenantId: string | null;
  tenantName: string | null;
  role: TenantRole;
  loading: boolean;
  /** Kept for backward compatibility — true when user is tenant owner */
  isSuperAdmin: boolean;
  userEmail: string | null;
}

interface UseTenantRoleReturn extends TenantContext {
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  canOperate: boolean;
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
    isSuperAdmin: false,
    userEmail: null,
  });

  const fetchTenantRole = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setContext({ 
          tenantId: null, 
          tenantName: null, 
          role: null, 
          loading: false,
          isSuperAdmin: false,
          userEmail: null,
        });
        return;
      }

      const userEmail = session.user.email || null;

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
        setContext({ 
          tenantId: null, 
          tenantName: null, 
          role: null, 
          loading: false,
          isSuperAdmin: false,
          userEmail,
        });
        return;
      }

      if (!membership || !membership.tenant) {
        setContext({ 
          tenantId: null, 
          tenantName: null, 
          role: null, 
          loading: false,
          isSuperAdmin: false,
          userEmail,
        });
        return;
      }

      // Type assertion for tenant
      const tenant = membership.tenant as { id: string; name: string; status: string };
      const role = membership.role as TenantRole;

      setContext({
        tenantId: tenant.id,
        tenantName: tenant.name,
        role,
        loading: false,
        isSuperAdmin: role === "owner",
        userEmail,
      });
    } catch (err) {
      console.error("Error in useTenantRole:", err);
      setContext({ 
        tenantId: null, 
        tenantName: null, 
        role: null, 
        loading: false,
        isSuperAdmin: false,
        userEmail: null,
      });
    }
  }, []);

  useEffect(() => {
    fetchTenantRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setContext({ 
            tenantId: null, 
            tenantName: null, 
            role: null, 
            loading: false,
            isSuperAdmin: false,
            userEmail: null,
          });
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
  const isManager = context.role === "manager";
  const isAgent = context.role === "agent";

  // Operational access: owner, admin, OR manager (not agent)
  const canOperate = isOwner || isAdmin || isManager;

  // Permission checks
  const canManageTemplates = canOperate;
  const canManageCampaigns = canOperate;
  const canManageChannels = canOperate;
  const canViewSettings = canOperate;
  const canViewAuditLogs = isAdmin;
  const canSendMessages = true;
  const canManageContacts = true;

  return {
    ...context,
    isOwner,
    isAdmin,
    isManager,
    isAgent,
    canOperate,
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
