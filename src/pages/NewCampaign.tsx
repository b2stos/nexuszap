import { Suspense, lazy, Component, ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle, Copy, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Lazy load the form to isolate potential crashes
const MTCampaignForm = lazy(() => 
  import("@/components/campaigns/MTCampaignForm").then(mod => ({ default: mod.MTCampaignForm }))
);

function FormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground">Carregando formulário...</span>
    </div>
  );
}

// Diagnostic error display component
function DiagnosticError({ 
  error, 
  errorInfo, 
  onBack 
}: { 
  error: Error | null; 
  errorInfo: React.ErrorInfo | null; 
  onBack: () => void;
}) {
  const errorMessage = error?.message || 'Erro desconhecido';
  const errorStack = error?.stack || '';
  const componentStack = errorInfo?.componentStack || '';
  
  const fullErrorText = `
ERROR MESSAGE:
${errorMessage}

ERROR STACK:
${errorStack}

COMPONENT STACK:
${componentStack}
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullErrorText);
    toast.success("Erro copiado para a área de transferência");
  };

  return (
    <Card className="border-destructive">
      <CardHeader className="bg-destructive/10">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Erro de Diagnóstico - Nova Campanha
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h4 className="font-semibold text-sm mb-1">Mensagem do Erro:</h4>
          <code className="block p-3 bg-muted rounded text-sm break-all text-destructive">
            {errorMessage}
          </code>
        </div>
        
        {errorStack && (
          <div>
            <h4 className="font-semibold text-sm mb-1">Stack Trace:</h4>
            <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
              {errorStack}
            </pre>
          </div>
        )}
        
        {componentStack && (
          <div>
            <h4 className="font-semibold text-sm mb-1">Component Stack:</h4>
            <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">
              {componentStack}
            </pre>
          </div>
        )}
        
        <div className="flex gap-2 pt-2">
          <Button onClick={handleCopy} variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copiar Erro
          </Button>
          <Button onClick={onBack} variant="default" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Campanhas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Error boundary with diagnostic display
interface ErrorBoundaryProps {
  children: ReactNode;
  onBack: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class DiagnosticErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Store error info for display
    this.setState({ errorInfo });
    
    // Log full error with stack trace for debugging
    console.error("[NewCampaignPage] ====== FULL ERROR ======");
    console.error("[NewCampaignPage] Error object:", error);
    console.error("[NewCampaignPage] Error message:", error.message);
    console.error("[NewCampaignPage] Error name:", error.name);
    console.error("[NewCampaignPage] Error stack:", error.stack);
    console.error("[NewCampaignPage] Component stack:", errorInfo.componentStack);
    console.error("[NewCampaignPage] ========================");
  }

  render() {
    if (this.state.hasError) {
      return (
        <DiagnosticError 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onBack={this.props.onBack}
        />
      );
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
        
        <DiagnosticErrorBoundary onBack={handleBack}>
          <Suspense fallback={<FormFallback />}>
            <MTCampaignForm />
          </Suspense>
        </DiagnosticErrorBoundary>
      </div>
    </DashboardLayout>
  );
}
