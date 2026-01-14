import { Suspense, lazy, Component, ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle
 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Lazy load the form to isolate potential crashes
const MTCampaignForm = lazy(() => 
  import("@/components/campaigns/MTCampaignForm").then(mod => ({ default: mod.MTCampaignForm }))
);

function FormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function FormError({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-medium">Erro ao carregar formulário</h3>
      <p className="text-muted-foreground mt-1 mb-4">
        Ocorreu um problema ao carregar o formulário de campanha.
      </p>
      <Button onClick={onBack} variant="outline">
        Voltar para Campanhas
      </Button>
    </div>
  );
}

// Simple error boundary
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundaryWrapper extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log full error with stack trace for debugging
    console.error("[NewCampaignPage] FULL ERROR:", error);
    console.error("[NewCampaignPage] Error message:", error.message);
    console.error("[NewCampaignPage] Error stack:", error.stack);
    console.error("[NewCampaignPage] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function NewCampaign() {
  const user = useProtectedUser();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/dashboard/campaigns");
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Nova Campanha</h2>
          <p className="text-muted-foreground mt-2">
            Crie uma campanha de mensagens usando templates aprovados
          </p>
        </div>
        
        <ErrorBoundaryWrapper fallback={<FormError onBack={handleBack} />}>
          <Suspense fallback={<FormFallback />}>
            <MTCampaignForm />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>
    </DashboardLayout>
  );
}