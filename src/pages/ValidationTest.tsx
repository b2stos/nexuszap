import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ValidationDemo } from "@/components/ValidationDemo";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";

export default function ValidationTest() {
  const user = useProtectedUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Teste de Validações
          </h2>
          <p className="text-muted-foreground mt-2">
            Teste todas as validações implementadas no sistema
          </p>
        </div>
        
        <ValidationDemo />
      </div>
    </DashboardLayout>
  );
}
