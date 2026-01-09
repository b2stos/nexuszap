/**
 * Audit Logs Page
 * 
 * Displays audit trail for admins
 */

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AuditLogsPanel } from "@/components/dashboard/AuditLogsPanel";
import { RequireRole } from "@/components/auth/RequireRole";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export default function AuditLogs() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <RequireRole requireAdmin>
      <DashboardLayout user={user}>
        <div className="container py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
            <p className="text-muted-foreground">
              Acompanhe as ações críticas realizadas na plataforma
            </p>
          </div>
          <AuditLogsPanel />
        </div>
      </DashboardLayout>
    </RequireRole>
  );
}
