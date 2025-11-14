import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Users, Send, PlusCircle, MessageSquare } from "lucide-react";

export function DashboardSidebar() {
  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
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
                    to="/dashboard/campaigns/new"
                    className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold hover:bg-muted"
                    activeClassName="bg-muted text-primary"
                  >
                    <PlusCircle className="h-6 w-6 shrink-0" />
                    Nova Campanha
                  </NavLink>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
