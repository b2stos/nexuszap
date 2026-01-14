/**
 * SwipeableConversationItem Component
 * 
 * Componente de conversa com suporte a swipe-to-delete (mobile) e hover delete (desktop)
 */

import { useState, useRef, useCallback } from 'react';
import { Trash2, Pin, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { InboxConversation } from '@/types/inbox';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SwipeableConversationItemProps {
  conversation: InboxConversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const rest = digits.substring(4);
    if (rest.length === 9) {
      return `(${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
    }
    return `(${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
  }
  return phone;
}

type ConversationState = 'active' | 'waiting' | 'closed';

function getConversationState(conversation: InboxConversation): ConversationState {
  if (conversation.status !== 'open') {
    return 'closed';
  }
  if (conversation.last_inbound_at) {
    const hoursSinceInbound = differenceInHours(new Date(), new Date(conversation.last_inbound_at));
    if (hoursSinceInbound < 24) {
      return 'active';
    }
  }
  return 'waiting';
}

function StateIndicator({ state }: { state: ConversationState }) {
  switch (state) {
    case 'active':
      return (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </div>
      );
    case 'waiting':
      return (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-orange-500" />
        </div>
      );
    case 'closed':
      return (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
        </div>
      );
    default:
      return null;
  }
}

export function SwipeableConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete,
}: SwipeableConversationItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const contact = conversation.contact;
  const displayName = contact?.name || formatPhone(contact?.phone || '');
  const lastMessageTime = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
        locale: ptBR,
      })
    : '';

  const state = getConversationState(conversation);
  const DELETE_THRESHOLD = -80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    
    // Only allow swiping left (negative values)
    if (diff < 0) {
      // Limit the swipe to max -100px with resistance
      const limitedDiff = Math.max(diff, -100);
      setTranslateX(limitedDiff);
    }
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false);
    
    if (translateX < DELETE_THRESHOLD) {
      // Show delete button fully
      setTranslateX(-80);
    } else {
      // Reset position
      setTranslateX(0);
    }
  }, [translateX]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleItemClick = () => {
    if (translateX < -20) {
      // If swiped, reset first
      setTranslateX(0);
      return;
    }
    onClick();
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button background (revealed on swipe) */}
      <div className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center">
        <button
          onClick={handleDeleteClick}
          className="w-full h-full flex items-center justify-center text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Swipeable content */}
      <div
        className={cn(
          "relative bg-card transition-transform",
          !isSwiping && "duration-200"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={handleItemClick}
          className={cn(
            "w-full flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors text-left border-b border-border/50 relative group",
            isActive && "bg-primary/10 hover:bg-primary/15 border-l-2 border-l-primary"
          )}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {(contact?.name?.[0] || contact?.phone?.[0] || '?').toUpperCase()}
              </span>
            </div>
            {state === 'active' && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {conversation.is_pinned && (
                  <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "font-medium truncate",
                    conversation.unread_count > 0 && "text-foreground",
                    !conversation.unread_count && "text-muted-foreground"
                  )}
                >
                  {displayName}
                </span>
                <StateIndicator state={state} />
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {lastMessageTime}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p
                className={cn(
                  "text-sm truncate",
                  conversation.unread_count > 0
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {conversation.last_message_preview || 'Sem mensagens'}
              </p>

              {conversation.unread_count > 0 && (
                <Badge
                  variant="default"
                  className="h-5 min-w-5 flex items-center justify-center rounded-full text-xs px-1.5 bg-green-500 hover:bg-green-500"
                >
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </Badge>
              )}
            </div>
          </div>

          {/* Desktop hover delete button */}
          <div
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-200 hidden md:flex",
              isHovered && translateX === 0 && "opacity-100"
            )}
          >
            <button
              onClick={handleDeleteClick}
              className="p-2 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
              title="Apagar conversa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </button>
      </div>
    </div>
  );
}
