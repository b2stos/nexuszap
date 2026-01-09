/**
 * TypingIndicator Component
 * 
 * Mostra quando outros atendentes estão digitando
 */

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  typingText: string | null;
  className?: string;
}

export function TypingIndicator({ typingText, className }: TypingIndicatorProps) {
  if (!typingText) return null;
  
  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="italic">{typingText}</span>
    </div>
  );
}
