import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  PlusCircle, 
  Menu, 
  Settings, 
  Crown, 
  Inbox, 
  FileText, 
  Phone,
  History,
  User,
  Shield
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenantRole, TenantRole } from "@/hooks/useTenantRole";

interface SidebarContentProps {
  isAppAdmin: boolean;
  tenantRole: TenantRole;
  isTenantAdmin: boolean;
  tenantName: string | null;
  isSuperAdmin: boolean;
}

function RoleBadge({ role, isSuperAdmin }: { role: TenantRole; isSuperAdmin: boolean }) {
  if (isSuperAdmin) {
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-600">
        Super Admin
      </Badge>
    );
  }

  if (!role) return null;

  const config = {
    owner: { label: "Proprietário", className: "bg-amber-500/10 text-amber-600" },
    admin: { label: "Admin", className: "bg-blue-500/10 text-blue-600" },
    agent: { label: "Agente", className: "bg-green-500/10 text-green-600" },
  };

  const c = config[role];
  if (!c) return null;

  return (
    <Badge variant="secondary" className={c.className}>
      {c.label}
    </Badge>
  );
}

function SidebarContent({ isAppAdmin, tenantRole, isTenantAdmin, tenantName, isSuperAdmin }: SidebarContentProps) {
  // Super admin sees everything
  const showAdminItems = isSuperAdmin || isTenantAdmin;
  const showSystemAdmin = isSuperAdmin || isAppAdmin;
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-card px-6 pb-4">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2">
        <Inbox className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-foreground">Nexus Zap</span>
      </div>

      {/* Tenant info */}
      {(tenantName || isSuperAdmin) && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{tenantName || "Admin Central"}</p>
          </div>
          <RoleBadge role={tenantRole} isSuperAdmin={isSuperAdmin} />
        </div>
      )}

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {/* Dashboard - Everyone */}
              <li>
                <NavLink
                  to="/dashboard"
                  end
                  className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                  activeClassName="bg-muted text-primary"
                >
                  <LayoutDashboard className="h-6 w-6 shrink-0" />
                  Dashboard
                </NavLink>
              </li>

              {/* Inbox - Everyone */}
              <li>
                <NavLink
                  to="/dashboard/inbox"
                  className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                  activeClassName="bg-muted text-primary"
                >
                  <Inbox className="h-6 w-6 shrink-0" />
                  Inbox
                </NavLink>
              </li>

              {/* Templates - Admin only */}
              {showAdminItems && (
                <li>
                  <NavLink
                    to="/dashboard/templates"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <FileText className="h-6 w-6 shrink-0" />
                    Templates
                  </NavLink>
                </li>
              )}

              {/* Contacts - Everyone */}
              <li>
                <NavLink
                  to="/dashboard/contacts"
                  className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                  activeClassName="bg-muted text-primary"
                >
                  <Users className="h-6 w-6 shrink-0" />
                  Contatos
                </NavLink>
              </li>

              {/* Campaigns - Admin only */}
              {showAdminItems && (
                <>
                  <li>
                    <NavLink
                      to="/dashboard/campaigns"
                      className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                      activeClassName="bg-muted text-primary"
                    >
                      <Send className="h-6 w-6 shrink-0" />
                      Campanhas
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/dashboard/campaigns/new"
                      className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                      activeClassName="bg-muted text-primary"
                    >
                      <PlusCircle className="h-6 w-6 shrink-0" />
                      Nova Campanha
                    </NavLink>
                  </li>
                </>
              )}

              {/* Channels - Admin only */}
              {showAdminItems && (
                <li>
                  <NavLink
                    to="/dashboard/channels"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <Phone className="h-6 w-6 shrink-0" />
                    Canais
                  </NavLink>
                </li>
              )}

              {/* Settings - Admin only */}
              {showAdminItems && (
                <li>
                  <NavLink
                    to="/dashboard/settings"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <Settings className="h-6 w-6 shrink-0" />
                    Configurações
                  </NavLink>
                </li>
              )}

              {/* Audit Logs - Admin only */}
              {showAdminItems && (
                <li>
                  <NavLink
                    to="/dashboard/audit-logs"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <History className="h-6 w-6 shrink-0" />
                    Logs de Auditoria
                  </NavLink>
                </li>
              )}
            </ul>
          </li>

          {/* App Admin section */}
          {showSystemAdmin && (
            <li>
              <Separator className="my-2" />
              <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Sistema
              </p>
              <ul role="list" className="-mx-2 space-y-1">
                <li>
                  <NavLink
                    to="/dashboard/admin"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted text-primary"
                    activeClassName="bg-muted text-primary"
                  >
                    <Crown className="h-6 w-6 shrink-0" />
                    Administração
                  </NavLink>
                </li>
              </ul>
            </li>
          )}
        </ul>
      </nav>

      {/* User info at bottom */}
      <div className="mt-auto border-t pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="text-xs">
            {isSuperAdmin ? "Super Admin" : tenantRole ? `Logado como ${tenantRole}` : "Sem organização"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const [open, setOpen] = useState(false);
  const { isAdmin: isAppAdmin } = useUserRole();
  const { role: tenantRole, isAdmin: isTenantAdmin, tenantName, isSuperAdmin } = useTenantRole();

  const sidebarProps = {
    isAppAdmin,
    tenantRole,
    isTenantAdmin,
    tenantName: tenantName || "",
    isSuperAdmin,
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="border-r border-border">
          <SidebarContent {...sidebarProps} />
        </div>
      </div>
    </>
  );
}
