/**
 * DemoModeToggle Component
 * 
 * Toggle para ativar/desativar o Demo Mode no Inbox
 * Visível apenas para Super Admins
 */

import { Eye, EyeOff, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDemoMode } from '@/hooks/useDemoMode';

export function DemoModeToggle() {
  const { isDemoMode, canUseDemoMode, isLoading, toggleDemoMode } = useDemoMode();

  // Não mostrar se não é Super Admin ou está carregando
  if (isLoading || !canUseDemoMode) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isDemoMode ? "default" : "outline"}
            size="sm"
            onClick={toggleDemoMode}
            className={`gap-2 ${isDemoMode ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
          >
            <TestTube className="w-4 h-4" />
            {isDemoMode ? (
              <>
                <span className="hidden sm:inline">Demo Mode ON</span>
                <EyeOff className="w-3 h-3" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Demo Mode</span>
                <Eye className="w-3 h-3" />
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isDemoMode 
              ? 'Clique para desativar e ver dados reais' 
              : 'Clique para ativar e ver dados fictícios'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DemoModeBanner() {
  const { isDemoMode, canUseDemoMode, isLoading } = useDemoMode();

  if (isLoading || !canUseDemoMode || !isDemoMode) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
      <TestTube className="w-4 h-4 text-amber-500" />
      <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
        Demo Mode ativo - Exibindo dados fictícios
      </span>
      <Badge variant="outline" className="ml-auto border-amber-500/50 text-amber-600 dark:text-amber-400">
        12 conversas simuladas
      </Badge>
    </div>
  );
}
