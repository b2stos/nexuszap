import { Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { RequireRole } from "@/components/auth/RequireRole";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import NewCampaign from "./pages/NewCampaign";
import CampaignDetail from "./pages/CampaignDetail";
import ValidationTest from "./pages/ValidationTest";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Inbox from "./pages/Inbox";
import Templates from "./pages/Templates";
import Channels from "./pages/Channels";
import AuditLogs from "./pages/AuditLogs";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import NotificameDiagnostics from "./pages/NotificameDiagnostics";
import Install from "./pages/Install";
import { InstallPrompt } from "./components/pwa/InstallPrompt";

// Global Error Boundary to prevent white screen on errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log with context for debugging
    console.error("[GlobalErrorBoundary] Critical error:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const isDashboardRoute = typeof window !== 'undefined' && 
        window.location.pathname.startsWith('/dashboard');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
              <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-destructive">Algo deu errado</h2>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || "Ocorreu um erro inesperado na aplicação."}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button 
                onClick={this.handleReload}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
              >
                Recarregar Página
              </button>
              <button 
                onClick={isDashboardRoute ? this.handleGoToDashboard : this.handleGoHome}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 text-sm font-medium"
              >
                {isDashboardRoute ? 'Voltar ao Dashboard' : 'Ir para Início'}
              </button>
            </div>
            {import.meta.env.DEV && this.state.error?.stack && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Ver diagnóstico (dev)
                </summary>
                <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider delayDuration={0}>
            <Toaster />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/install" element={<Install />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/como-funciona" element={<HowItWorks />} />
              <Route path="/precos" element={<Pricing />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/dashboard/templates" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Templates /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/dashboard/campaigns" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Campaigns /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/campaigns/new" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><NewCampaign /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/campaigns/:id" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><CampaignDetail /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/channels" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Channels /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Settings /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
              <Route path="/dashboard/validation-test" element={<ProtectedRoute><ValidationTest /></ProtectedRoute>} />
              <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/dashboard/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />
              <Route path="/dashboard/diagnostics" element={<ProtectedRoute><AdminRoute><NotificameDiagnostics /></AdminRoute></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <InstallPrompt delay={45000} />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;