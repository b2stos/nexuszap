import { ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardSidebar />
      <div className="lg:pl-64 flex flex-col flex-1">
        <DashboardHeader user={user} />
        <main className="p-4 lg:p-8 pt-16 lg:pt-8 flex-1">
          {children}
        </main>
        <footer className="py-4 px-4 lg:px-8 text-center border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Produto desenvolvido por B2 Digital · CNPJ 54.761.878/0001-79
          </p>
        </footer>
      </div>
    </div>
  );
}
