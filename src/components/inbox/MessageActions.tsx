/**
 * MessageActions Component
 * 
 * Ações contextuais em mensagens: copiar, reagir, etc.
 */

import { useState } from 'react';
import { Copy, Smile, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { REACTION_EMOJIS, ReactionEmoji } from '@/hooks/useMessageReactions';
import { toast } from 'sonner';

interface MessageActionsProps {
  messageContent: string;
  messageId: string;
  currentReaction?: string;
  onReact: (emoji: string) => void;
  isVisible: boolean;
  isOutbound: boolean;
}

export function MessageActions({
  messageContent,
  messageId,
  currentReaction,
  onReact,
  isVisible,
  isOutbound,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  
  const handleCopy = async () => {
    if (!messageContent) return;
    
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      toast.success('Copiado!', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };
  
  const handleReact = (emoji: string) => {
    onReact(emoji);
    setEmojiOpen(false);
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={cn(
      "absolute top-0 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-background/95 shadow-md border border-border",
      "opacity-0 group-hover:opacity-100 transition-opacity",
      isOutbound ? "right-full mr-1" : "left-full ml-1"
    )}>
      {/* Copy button */}
      {messageContent && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      
      {/* Reaction picker */}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="center" 
          className="w-auto p-1.5"
        >
          <div className="flex gap-0.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full text-lg hover:bg-muted transition-colors",
                  currentReaction === emoji && "bg-primary/20"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Display reactions on a message
interface MessageReactionsDisplayProps {
  reactions: Map<string, { userId: string; userName?: string }[]>;
  onReactionClick: (emoji: string) => void;
}

export function MessageReactionsDisplay({
  reactions,
  onReactionClick,
}: MessageReactionsDisplayProps) {
  if (reactions.size === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Array.from(reactions.entries()).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReactionClick(emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full",
            "bg-muted/80 hover:bg-muted text-xs transition-colors"
          )}
        >
          <span>{emoji}</span>
          {users.length > 1 && (
            <span className="text-muted-foreground">{users.length}</span>
          )}
        </button>
      ))}
    </div>
  );
}
