import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Users, Send, PlusCircle, MessageSquare, QrCode, MessageCircle, Menu, Settings, Crown, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";

function SidebarContent({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-card px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center gap-2">
        <MessageSquare className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-foreground">Nexus Zap</span>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
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
                  to="/dashboard/send-message"
                  className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                  activeClassName="bg-muted text-primary"
                >
                  <MessageCircle className="h-6 w-6 shrink-0" />
                  Enviar Mensagem
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
              <li>
                <NavLink
                  to="/dashboard/whatsapp"
                  className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                  activeClassName="bg-muted text-primary"
                >
                  <QrCode className="h-6 w-6 shrink-0" />
                  WhatsApp
                </NavLink>
              </li>
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
              {isAdmin && (
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
              )}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export function DashboardSidebar() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useUserRole();

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
            <SidebarContent isAdmin={isAdmin} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="border-r border-border">
          <SidebarContent isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
