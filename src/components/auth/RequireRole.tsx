/**
 * RequireRole Component
 * 
 * Protects routes based on tenant role.
 * Shows access denied message for unauthorized users.
 */

import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useTenantRole, TenantRole } from "@/hooks/useTenantRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RequireRoleProps {
  children: ReactNode;
  /** Required roles - user must have one of these */
  roles?: TenantRole[];
  /** Alternative: require admin (owner or admin) */
  requireAdmin?: boolean;
  /** Alternative: require operator (owner, admin, or manager) */
  requireOperator?: boolean;
  /** Redirect path for unauthorized (default: show access denied) */
  redirectTo?: string;
  /** Show inline access denied instead of full page */
  inline?: boolean;
}

export function RequireRole({
  children,
  roles,
  requireAdmin = false,
  requireOperator = false,
  redirectTo,
  inline = false,
}: RequireRoleProps) {
  const location = useLocation();
  const { role, loading, isAdmin, canOperate, tenantId, isSuperAdmin } = useTenantRole();

  // Loading state
  if (loading) {
    if (inline) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super admin bypasses ALL checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // No tenant context (and not super admin)
  if (!tenantId) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  // Check authorization
  let isAuthorized = false;

  if (requireAdmin) {
    isAuthorized = isAdmin;
  } else if (requireOperator) {
    isAuthorized = canOperate;
  } else if (roles && roles.length > 0) {
    isAuthorized = roles.includes(role);
  } else {
    isAuthorized = true; // No role requirement
  }

  // Redirect if specified
  if (!isAuthorized && redirectTo) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Show access denied
  if (!isAuthorized) {
    if (inline) {
      return (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <span className="font-medium">Acesso negado</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Você não tem permissão para acessar este recurso.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>Esta funcionalidade é restrita a administradores.</p>
              <p className="mt-1">
                Se você acredita que isso é um erro, entre em contato com o administrador da sua organização.
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => window.history.back()}>
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Higher-order component for role-based access
 */
export function withRequireRole<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<RequireRoleProps, "children">
) {
  return function WrappedComponent(props: P) {
    return (
      <RequireRole {...options}>
        <Component {...props} />
      </RequireRole>
    );
  };
}
