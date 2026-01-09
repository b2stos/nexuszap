/**
 * MessageComposer Component
 * 
 * Campo de digitação de mensagens estilo WhatsApp Web com suporte a emoji e mídia
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { 
  Send, 
  Clock, 
  Loader2, 
  Smile, 
  Paperclip, 
  Mic, 
  Image as ImageIcon,
  FileText,
  Camera,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { WindowStatus } from '@/types/inbox';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  conversationId: string;
  windowStatus: WindowStatus;
  onSend: (text: string) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}

// Simple emoji picker (commonly used emojis)
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝',
  '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏',
  '🙌', '👐', '🤲', '🙏', '✨', '🎉', '🎊', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯',
];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1 p-2 max-h-48 overflow-y-auto">
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function MessageComposer({
  conversationId,
  windowStatus,
  onSend,
  isSending,
  disabled = false,
}: MessageComposerProps) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
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
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
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
  
  // Add emoji to text
  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };
  
  // Window closed state
  if (!windowStatus.isOpen) {
    return (
      <div className="p-4 border-t border-border bg-card">
        <Alert variant="destructive" className="mb-0 bg-orange-500/10 border-orange-500/30">
          <Clock className="h-4 w-4 text-orange-500" />
          <AlertDescription className="flex items-center justify-between text-foreground">
            <span>
              Fora da janela de 24h. Use um <strong>template</strong> para iniciar/retomar a conversa.
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="p-3 border-t border-border bg-card">
      {/* Window status indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Janela aberta • {windowStatus.remainingFormatted}</span>
      </div>
      
      {/* Composer */}
      <div className="flex items-end gap-2">
        {/* Emoji picker */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={disabled || isSending}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-72 p-0">
            <EmojiPicker onSelect={handleEmojiSelect} />
          </PopoverContent>
        </Popover>
        
        {/* Attachment menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={disabled || isSending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem disabled>
              <ImageIcon className="w-4 h-4 mr-2" />
              Imagem
              <span className="text-xs text-muted-foreground ml-auto">Em breve</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <FileText className="w-4 h-4 mr-2" />
              Documento
              <span className="text-xs text-muted-foreground ml-auto">Em breve</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Camera className="w-4 h-4 mr-2" />
              Câmera
              <span className="text-xs text-muted-foreground ml-auto">Em breve</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            disabled={disabled || isSending}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none py-3 px-4",
              "bg-muted/50 border-0 rounded-2xl",
              "focus-visible:ring-1 focus-visible:ring-primary"
            )}
            rows={1}
          />
        </div>
        
        {/* Audio button or Send button */}
        {text.trim() ? (
          <Button
            onClick={handleSend}
            disabled={!text.trim() || isSending || disabled}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            disabled
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      {/* Tip */}
      <p className="text-[10px] text-muted-foreground mt-2 px-1">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Enter</kbd> para enviar • 
        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px] ml-1">Shift+Enter</kbd> para nova linha
      </p>
    </div>
  );
}
