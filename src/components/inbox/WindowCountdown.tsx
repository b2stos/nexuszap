/**
 * WindowCountdown Component
 * 
 * Exibe contagem regressiva em tempo real da janela de 24h
 */

import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WindowStatus } from '@/types/inbox';

interface WindowCountdownProps {
  windowStatus: WindowStatus;
  compact?: boolean;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0m';
  
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function WindowCountdown({ windowStatus, compact = false }: WindowCountdownProps) {
  const [remaining, setRemaining] = useState(windowStatus.remainingMs);
  const [isOpen, setIsOpen] = useState(windowStatus.isOpen);
  
  // Atualizar countdown em tempo real
  useEffect(() => {
    if (!windowStatus.closesAt) {
      setRemaining(0);
      setIsOpen(false);
      return;
    }
    
    const updateCountdown = () => {
      const now = new Date();
      const ms = Math.max(0, windowStatus.closesAt!.getTime() - now.getTime());
      setRemaining(ms);
      setIsOpen(ms > 0);
    };
    
    // Atualizar imediatamente
    updateCountdown();
    
    // Atualizar a cada segundo
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [windowStatus.closesAt]);
  
  // Determinar urgência do countdown
  const isUrgent = isOpen && remaining < 60 * 60 * 1000; // Menos de 1 hora
  const isCritical = isOpen && remaining < 15 * 60 * 1000; // Menos de 15 minutos
  
  if (compact) {
    return (
      <Badge 
        variant={isOpen ? (isCritical ? 'destructive' : isUrgent ? 'default' : 'secondary') : 'outline'}
        className={`text-xs ${isCritical ? 'animate-pulse' : ''}`}
      >
        {isOpen ? (
          <>
            <Clock className="w-3 h-3 mr-1" />
            {formatTimeRemaining(remaining)}
          </>
        ) : (
          <>
            <XCircle className="w-3 h-3 mr-1" />
            Fechada
          </>
        )}
      </Badge>
    );
  }
  
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
      isOpen 
        ? isCritical 
          ? 'border-destructive/50 bg-destructive/10' 
          : isUrgent 
            ? 'border-orange-500/50 bg-orange-500/10' 
            : 'border-green-500/50 bg-green-500/10'
        : 'border-muted bg-muted/50'
    }`}>
      {isOpen ? (
        <>
          {isCritical ? (
            <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
          ) : isUrgent ? (
            <Clock className="w-5 h-5 text-orange-500" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${
              isCritical ? 'text-destructive' : isUrgent ? 'text-orange-600' : 'text-green-600'
            }`}>
              {isCritical ? 'Fechando em breve!' : isUrgent ? 'Atenção' : 'Janela Aberta'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTimeRemaining(remaining)} restantes
            </p>
          </div>
        </>
      ) : (
        <>
          <XCircle className="w-5 h-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-muted-foreground">Janela Fechada</p>
            <p className="text-xs text-muted-foreground">
              Apenas templates permitidos
            </p>
          </div>
        </>
      )}
    </div>
  );
}
