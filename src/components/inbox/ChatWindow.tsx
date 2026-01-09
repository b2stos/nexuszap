/**
 * ChatWindow Component
 * 
 * Área central do chat com mensagens e composer
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { Phone, MoreVertical, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { InboxConversation, InboxMessage, WindowStatus } from '@/types/inbox';
import { MessageBubble, DateSeparator } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { useSendMessage, useRetryMessage } from '@/hooks/useSendMessage';
import { format, isSameDay } from 'date-fns';

interface ChatWindowProps {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  isLoading: boolean;
  windowStatus: WindowStatus;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const rest = digits.substring(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
    }
    return `+55 (${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
  }
  return `+${digits}`;
}

function ChatHeader({ conversation }: { conversation: InboxConversation }) {
  const contact = conversation.contact;
  const displayName = contact?.name || 'Sem nome';
  const phone = contact?.phone ? formatPhone(contact.phone) : '';
  
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
          <span className="text-sm font-semibold text-primary">
            {(contact?.name?.[0] || contact?.phone?.[0] || '?').toUpperCase()}
          </span>
        </div>
        
        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{displayName}</h3>
            <Badge 
              variant={conversation.status === 'open' ? 'default' : 'secondary'}
              className="text-[10px] h-5"
            >
              {conversation.status === 'open' ? 'Aberta' : 'Resolvida'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {phone}
          </p>
        </div>
      </div>
      
      <Button variant="ghost" size="icon">
        <MoreVertical className="w-5 h-5" />
      </Button>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-start">
        <Skeleton className="h-16 w-48 rounded-lg" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-56 rounded-lg" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-64 rounded-lg" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
      <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <MessageCircle className="w-12 h-12 opacity-50" />
      </div>
      <h3 className="text-lg font-medium mb-1">Selecione uma conversa</h3>
      <p className="text-sm">Escolha uma conversa na lista para ver as mensagens</p>
    </div>
  );
}

export function ChatWindow({ conversation, messages, isLoading, windowStatus }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendMessage = useSendMessage();
  const retryMessage = useRetryMessage();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);
  
  // Group messages by date
  const messagesWithDates = useMemo(() => {
    const result: { type: 'date' | 'message'; date?: Date; message?: InboxMessage }[] = [];
    let lastDate: Date | null = null;
    
    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at);
      
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        result.push({ type: 'date', date: msgDate });
        lastDate = msgDate;
      }
      
      result.push({ type: 'message', message: msg });
    });
    
    return result;
  }, [messages]);
  
  // Handle send
  const handleSend = useCallback(async (text: string) => {
    if (!conversation) return;
    
    await sendMessage.mutateAsync({
      conversationId: conversation.id,
      text,
    });
  }, [conversation, sendMessage]);
  
  // Handle retry
  const handleRetry = useCallback((message: InboxMessage) => {
    if (!conversation || !message.content) return;
    
    retryMessage.mutate({
      conversationId: conversation.id,
      originalText: message.content,
    });
  }, [conversation, retryMessage]);
  
  if (!conversation) {
    return <EmptyState />;
  }
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <ChatHeader conversation={conversation} />
      
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 min-h-full">
          {isLoading ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageCircle className="w-12 h-12 opacity-50 mb-2" />
              <p>Nenhuma mensagem ainda</p>
            </div>
          ) : (
            messagesWithDates.map((item, index) => {
              if (item.type === 'date' && item.date) {
                return <DateSeparator key={`date-${index}`} date={item.date} />;
              }
              if (item.type === 'message' && item.message) {
                return (
                  <MessageBubble 
                    key={item.message.id} 
                    message={item.message} 
                    onRetry={handleRetry}
                  />
                );
              }
              return null;
            })
          )}
        </div>
      </ScrollArea>
      
      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        windowStatus={windowStatus}
        onSend={handleSend}
        isSending={sendMessage.isPending}
      />
    </div>
  );
}
