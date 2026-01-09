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
import WhatsApp from "./pages/WhatsApp";
import ValidationTest from "./pages/ValidationTest";
import SendMessage from "./pages/SendMessage";
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
import NotFound from "./pages/NotFound";

// Error Boundary to prevent white screen on errors
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
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-xl font-bold text-destructive">Algo deu errado</h2>
            <p className="text-muted-foreground">{this.state.error?.message || "Erro inesperado"}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Recarregar Página
            </button>
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
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/sobre" element={<About />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="/como-funciona" element={<HowItWorks />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/dashboard/templates" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Templates /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/dashboard/campaigns" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Campaigns /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/campaigns/new" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><NewCampaign /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/dashboard/channels" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Channels /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/send-message" element={<ProtectedRoute><SendMessage /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><RequireRole requireAdmin redirectTo="/dashboard"><Settings /></RequireRole></ProtectedRoute>} />
              <Route path="/dashboard/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
              <Route path="/dashboard/validation-test" element={<ProtectedRoute><ValidationTest /></ProtectedRoute>} />
              <Route path="/dashboard/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
