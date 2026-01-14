import { Suspense, lazy, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CampaignsHeader } from "@/components/campaigns/CampaignsHeader";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

// Lazy load the problematic grid component to isolate crashes
const MTCampaignsGrid = lazy(() => 
  import("@/components/campaigns/MTCampaignsGrid").then(mod => ({ default: mod.MTCampaignsGrid }))
);

function CampaignsGridFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function CampaignsGridError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-medium">Erro ao carregar campanhas</h3>
      <p className="text-muted-foreground mt-1 mb-4">
        Ocorreu um problema ao carregar a lista de campanhas.
      </p>
      <Button onClick={onRetry} variant="outline">
        Tentar novamente
      </Button>
    </div>
  );
}

export default function Campaigns() {
  const user = useProtectedUser();
  const [loadGrid, setLoadGrid] = useState(true);
  const [errorKey, setErrorKey] = useState(0);

  const handleRetry = () => {
    setErrorKey(prev => prev + 1);
    setLoadGrid(true);
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <CampaignsHeader />
        
        {loadGrid ? (
          <ErrorBoundaryWrapper 
            key={errorKey}
            fallback={<CampaignsGridError onRetry={handleRetry} />}
          >
            <Suspense fallback={<CampaignsGridFallback />}>
              <MTCampaignsGrid />
            </Suspense>
          </ErrorBoundaryWrapper>
        ) : (
          <CampaignsGridError onRetry={handleRetry} />
        )}
      </div>
    </DashboardLayout>
  );
}

// Simple error boundary wrapper
import { Component, ReactNode } from "react";

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

  componentDidCatch(error: Error) {
    console.error("[CampaignsPage] Error caught:", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}