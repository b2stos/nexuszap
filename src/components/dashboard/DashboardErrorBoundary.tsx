/**
 * DashboardErrorBoundary
 * 
 * Error boundary específico para páginas do dashboard.
 * Previne tela branca exibindo fallback amigável com opções de recuperação.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, ChevronDown, ChevronUp, Copy, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with context
    console.error('[DashboardErrorBoundary] Caught error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      timestamp: new Date().toISOString(),
    });
    
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleGoToDashboard = () => {
    window.location.href = '/dashboard';
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Route: ${typeof window !== 'undefined' ? window.location.pathname : 'unknown'}
Timestamp: ${new Date().toISOString()}

Stack Trace:
${error?.stack || 'No stack trace'}

Component Stack:
${errorInfo?.componentStack || 'No component stack'}
    `.trim();
    
    navigator.clipboard.writeText(errorText).then(() => {
      // Could use toast here, but keeping it simple
      alert('Detalhes do erro copiados para a área de transferência');
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, showDetails } = this.state;
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-lg w-full shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {this.props.fallbackTitle || 'Opa, algo deu errado'}
              </CardTitle>
              <CardDescription className="mt-2">
                {this.props.fallbackDescription || 
                  'Ocorreu um erro inesperado ao carregar esta página. Você pode tentar recarregar ou voltar ao dashboard.'}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error message preview */}
              <Alert variant="destructive" className="text-sm">
                <AlertDescription>
                  {error?.message || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="default" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button onClick={this.handleReload} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Recarregar página
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={this.handleGoBack} variant="ghost" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={this.handleGoToDashboard} variant="ghost" className="gap-2">
                  <Home className="h-4 w-4" />
                  Ir para Dashboard
                </Button>
              </div>

              {/* Debug toggle - only in dev or when explicitly shown */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground text-xs"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                >
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ocultar diagnóstico
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver diagnóstico
                    </>
                  )}
                </Button>

                {showDetails && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        Rota: {typeof window !== 'undefined' ? window.location.pathname : 'unknown'}
                      </span>
                      <Button variant="ghost" size="sm" onClick={this.handleCopyError} className="gap-1 h-7 px-2">
                        <Copy className="h-3 w-3" />
                        <span className="text-xs">Copiar</span>
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap break-words font-mono">
                      {isDev ? (error?.stack || 'No stack trace available') : error?.message}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;
