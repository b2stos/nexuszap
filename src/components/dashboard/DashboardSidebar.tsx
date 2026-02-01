import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Shield,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenantRole, TenantRole } from "@/hooks/useTenantRole";
import { useActiveCampaigns } from "@/hooks/useActiveCampaigns";
import { ActiveCampaignIndicator } from "./ActiveCampaignIndicator";
import { supabase } from "@/integrations/supabase/client";
import { ActiveCampaign } from "@/contexts/CampaignBackgroundContext";

interface SidebarContentProps {
  isAppAdmin: boolean;
  tenantRole: TenantRole;
  isTenantAdmin: boolean;
  tenantName: string | null;
  isSuperAdmin: boolean;
  userProfile: { full_name: string | null; email: string; avatar_url: string | null } | null;
  onProfileClick: () => void;
  activeCampaigns: ActiveCampaign[];
  showCampaignPanel: boolean;
  onToggleCampaignPanel: () => void;
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

function SidebarContent({ 
  isAppAdmin, 
  tenantRole, 
  isTenantAdmin, 
  tenantName, 
  isSuperAdmin, 
  userProfile, 
  onProfileClick,
  activeCampaigns,
  showCampaignPanel,
  onToggleCampaignPanel 
}: SidebarContentProps) {
  // Super admin sees everything
  const showAdminItems = isSuperAdmin || isTenantAdmin;
  const showSystemAdmin = isSuperAdmin || isAppAdmin;
  const runningCampaigns = activeCampaigns.filter(c => c.status === "running");

  function getInitials(name: string | null) {
    if (!name) return "U";
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

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
                <li>
                  <Collapsible open={showCampaignPanel} onOpenChange={onToggleCampaignPanel}>
                    <div className="flex items-center">
                      <NavLink
                        to="/dashboard/campaigns"
                        className="group flex flex-1 gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                        activeClassName="bg-muted text-primary"
                      >
                        <Send className="h-6 w-6 shrink-0" />
                        Campanhas
                        {runningCampaigns.length > 0 && (
                          <Badge className="ml-auto bg-primary text-primary-foreground animate-pulse">
                            {runningCampaigns.length}
                          </Badge>
                        )}
                      </NavLink>
                      {runningCampaigns.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mr-1">
                            <ChevronDown className={`h-4 w-4 transition-transform ${showCampaignPanel ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                    <CollapsibleContent>
                      <ActiveCampaignIndicator 
                        campaigns={runningCampaigns} 
                        onClose={() => onToggleCampaignPanel()} 
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </li>
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
                <li>
                  <NavLink
                    to="/dashboard/diagnostics"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <Settings className="h-6 w-6 shrink-0" />
                    Diagnóstico API
                  </NavLink>
                </li>
              </ul>
            </li>
          )}
        </ul>
      </nav>

      {/* User Profile at bottom */}
      <div className="mt-auto border-t pt-4">
        <button
          onClick={onProfileClick}
          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left group"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.full_name || "User"} />
            <AvatarFallback className="text-xs bg-primary/10">
              {getInitials(userProfile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {userProfile?.full_name || "Sem nome"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {userProfile?.email || ""}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const [open, setOpen] = useState(false);
  const [showCampaignPanel, setShowCampaignPanel] = useState(false);
  const navigate = useNavigate();
  const { isAdmin: isAppAdmin } = useUserRole();
  const { role: tenantRole, isAdmin: isTenantAdmin, tenantName, isSuperAdmin } = useTenantRole();
  const { activeCampaigns } = useActiveCampaigns();
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    async function fetchUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setUserProfile(data);
      }
    }

    fetchUserProfile();
  }, []);

  const handleProfileClick = () => {
    setOpen(false); // Close mobile menu if open
    navigate("/dashboard/profile");
  };

  const handleToggleCampaignPanel = () => {
    setShowCampaignPanel(prev => !prev);
  };

  const sidebarProps = {
    isAppAdmin,
    tenantRole,
    isTenantAdmin,
    tenantName: tenantName || "",
    isSuperAdmin,
    userProfile,
    onProfileClick: handleProfileClick,
    activeCampaigns,
    showCampaignPanel,
    onToggleCampaignPanel: handleToggleCampaignPanel,
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
