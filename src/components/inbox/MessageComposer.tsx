/**
 * MessageComposer Component
 * 
 * Campo de digitação de mensagens com validação de janela 24h
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WindowStatus } from '@/types/inbox';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  conversationId: string;
  windowStatus: WindowStatus;
  onSend: (text: string) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}

export function MessageComposer({
  conversationId,
  windowStatus,
  onSend,
  isSending,
  disabled = false,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Focus textarea when conversation changes
  useEffect(() => {
    if (conversationId && windowStatus.isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [conversationId, windowStatus.isOpen]);
  
  // Handle send
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !windowStatus.isOpen) return;
    
    try {
      await onSend(trimmed);
      setText('');
      
      // Re-focus textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error) {
      // Error handled by parent
      console.error('Send error:', error);
    }
  };
  
  // Handle keyboard
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for new line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Auto-resize textarea
  const handleChange = (value: string) => {
    setText(value);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };
  
  // Window closed state
  if (!windowStatus.isOpen) {
    return (
      <div className="p-4 border-t border-border bg-card">
        <Alert variant="destructive" className="mb-0">
          <Clock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Fora da janela de 24h. Use um <strong>template</strong> para iniciar/retomar a conversa.
            </span>
            <Button variant="outline" size="sm" className="ml-2" disabled>
              Enviar Template
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="p-4 border-t border-border bg-card">
      {/* Window status indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Janela aberta • {windowStatus.remainingFormatted}</span>
      </div>
      
      {/* Composer */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            disabled={disabled || isSending}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none pr-12",
              "focus-visible:ring-1 focus-visible:ring-primary"
            )}
            rows={1}
          />
        </div>
        
        <Button
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      
      {/* Tip */}
      <p className="text-xs text-muted-foreground mt-2">
        Pressione <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> para enviar, 
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] ml-1">Shift+Enter</kbd> para nova linha
      </p>
    </div>
  );
}
