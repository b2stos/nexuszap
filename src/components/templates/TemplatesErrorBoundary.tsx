/**
 * TemplatesErrorBoundary Component
 * 
 * Error boundary específico para a página de Templates
 * Exibe fallback amigável com opção de recarregar
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class TemplatesErrorBoundary extends Component<Props, State> {
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
    console.error('TemplatesErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    this.props.onReset?.();
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}
    `.trim();
    
    navigator.clipboard.writeText(errorText);
    toast.success('Detalhes do erro copiados!');
  };

  render() {
    if (this.state.hasError) {
      const { error, showDetails } = this.state;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-lg w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle>Falha ao carregar Templates</CardTitle>
              <CardDescription>
                Ocorreu um erro inesperado ao renderizar esta página.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  {error?.message || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={this.handleReset} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Recarregar Página
                </Button>
                <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </div>

              {/* Debug toggle */}
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                >
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ocultar detalhes técnicos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver detalhes técnicos
                    </>
                  )}
                </Button>

                {showDetails && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={this.handleCopyError} className="gap-1">
                        <Copy className="h-3 w-3" />
                        Copiar erro
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-[200px] whitespace-pre-wrap break-words">
                      {error?.stack || 'No stack trace available'}
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

export default TemplatesErrorBoundary;
