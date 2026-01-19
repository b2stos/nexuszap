import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

interface InstallPromptProps {
  delay?: number; // Delay in ms before showing prompt
}

export function InstallPrompt({ delay = 30000 }: InstallPromptProps) {
  const { 
    shouldShowPrompt, 
    isIOS, 
    isAndroid, 
    promptInstall, 
    dismissPrompt,
    isStandalone
  } = usePWA();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Don't show if already in standalone mode or shouldn't show
    if (!shouldShowPrompt || isStandalone) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
      // Trigger animation after a brief delay
      setTimeout(() => setIsAnimating(true), 50);
    }, delay);

    return () => clearTimeout(timer);
  }, [shouldShowPrompt, isStandalone, delay]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      dismissPrompt();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 ease-out ${
        isAnimating 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 mx-auto max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <img 
              src="/pwa-192x192.png" 
              alt="Nexus Zap" 
              className="w-8 h-8 rounded-lg"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Instalar Nexus Zap
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acesse mais rápido direto da tela inicial
                </p>
              </div>
              <button 
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mt-3 flex gap-2">
              {isIOS ? (
                <div className="text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Toque em <Share className="h-3 w-3 inline" /> e depois em 
                    <span className="font-medium text-foreground ml-1">
                      "Adicionar à Tela Inicial"
                    </span>
                  </span>
                </div>
              ) : (
                <>
                  <Button 
                    size="sm" 
                    onClick={handleInstall}
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Instalar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={handleClose}
                  >
                    Agora não
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
