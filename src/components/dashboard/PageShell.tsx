/**
 * PageShell Component
 * 
 * Wrapper padronizado para páginas do dashboard que garante:
 * - Loading state com skeleton
 * - Empty state quando não há dados
 * - Error state com retry
 * - Nunca retorna null/undefined
 */

import { ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { DashboardLayout } from './DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, RefreshCw, AlertTriangle, FileX } from 'lucide-react';

interface PageShellProps {
  user: User | null;
  children: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  // Customization
  loadingComponent?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
}

// Default loading skeleton
function DefaultLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Default empty state
function DefaultEmptyState({ 
  title = 'Nenhum item encontrado',
  description = 'Não há dados para exibir no momento.',
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon || <FileX className="h-12 w-12 text-muted-foreground/50 mb-4" />}
      <h3 className="font-medium text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
      {action}
    </div>
  );
}

// Default error state
function DefaultErrorState({
  title = 'Erro ao carregar',
  description,
  error,
  onRetry,
}: {
  title?: string;
  description?: string;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const errorMessage = error?.message || 'Ocorreu um erro inesperado';
  
  return (
    <div className="container py-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <p className="font-medium">{title}</p>
          <p className="text-sm">{description || errorMessage}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function PageShell({
  user,
  children,
  isLoading = false,
  isError = false,
  error = null,
  isEmpty = false,
  onRetry,
  loadingComponent,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  errorTitle,
  errorDescription,
}: PageShellProps) {
  // Loading state - always show skeleton, never blank
  if (isLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="container py-6">
          {loadingComponent || <DefaultLoadingSkeleton />}
        </div>
      </DashboardLayout>
    );
  }

  // Error state - show error with retry option
  if (isError) {
    return (
      <DashboardLayout user={user}>
        <DefaultErrorState
          title={errorTitle}
          description={errorDescription}
          error={error}
          onRetry={onRetry}
        />
      </DashboardLayout>
    );
  }

  // Empty state - show friendly message
  if (isEmpty) {
    return (
      <DashboardLayout user={user}>
        <div className="container py-6">
          <DefaultEmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={emptyIcon}
            action={emptyAction}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Normal render - wrap in layout
  return (
    <DashboardLayout user={user}>
      {children}
    </DashboardLayout>
  );
}

// Compact loading component for inline use
export function InlineLoader({ text = 'Carregando...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}

// Centered full-height loader
export function FullPageLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default PageShell;
