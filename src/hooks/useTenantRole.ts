/**
 * Hook for tenant-level role checking (RBAC)
 * 
 * Roles:
 * - owner: Full access to everything
 * - admin: Full access except billing/tenant deletion
 * - agent: Limited access (inbox, contacts, view-only templates/campaigns)
 * 
 * Super Admin: Bypasses all restrictions (configured in superAdmin.ts)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSuperAdminEmail } from "@/utils/superAdmin";

export type TenantRole = "owner" | "admin" | "agent" | null;

interface TenantContext {
  tenantId: string | null;
  tenantName: string | null;
  role: TenantRole;
  loading: boolean;
  isSuperAdmin: boolean;
  userEmail: string | null;
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
      const superAdmin = isSuperAdminEmail(userEmail);

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
        // Super admin still gets access even without tenant
        setContext({ 
          tenantId: null, 
          tenantName: null, 
          role: superAdmin ? "owner" : null, 
          loading: false,
          isSuperAdmin: superAdmin,
          userEmail,
        });
        return;
      }

      if (!membership || !membership.tenant) {
        // Super admin still gets access even without tenant
        setContext({ 
          tenantId: null, 
          tenantName: superAdmin ? "Admin Central" : null, 
          role: superAdmin ? "owner" : null, 
          loading: false,
          isSuperAdmin: superAdmin,
          userEmail,
        });
        return;
      }

      // Type assertion for tenant
      const tenant = membership.tenant as { id: string; name: string; status: string };

      setContext({
        tenantId: tenant.id,
        tenantName: tenant.name,
        role: superAdmin ? "owner" : membership.role as TenantRole,
        loading: false,
        isSuperAdmin: superAdmin,
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

  // Super admin bypasses all checks
  const { isSuperAdmin } = context;

  // Role checks - super admin always has full access
  const isOwner = isSuperAdmin || context.role === "owner";
  const isAdmin = isSuperAdmin || context.role === "owner" || context.role === "admin";
  const isAgent = !isSuperAdmin && context.role === "agent";

  // Permission checks - super admin has all permissions
  const canManageTemplates = isSuperAdmin || isAdmin;
  const canManageCampaigns = isSuperAdmin || isAdmin;
  const canManageChannels = isSuperAdmin || isAdmin;
  const canViewSettings = isSuperAdmin || isAdmin;
  const canViewAuditLogs = isSuperAdmin || isAdmin;
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
