/**
 * ChatWindow Component
 * 
 * Área central do chat estilo WhatsApp Web com mensagens, composer e suporte a mídia
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Phone, MoreVertical, MessageCircle, ArrowDown, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { InboxConversation, InboxMessage, WindowStatus } from '@/types/inbox';
import { MessageBubble, DateSeparator } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { TemplateComposer } from './TemplateComposer';
import { useSendMessage, useRetryMessage } from '@/hooks/useSendMessage';
import { useSendTemplate } from '@/hooks/useSendTemplate';
import { useApprovedTemplates, useCurrentTenantForTemplates } from '@/hooks/useTemplates';
import { format, isSameDay, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function ChatHeader({ 
  conversation, 
  windowStatus,
  onResolve,
  onReopen,
}: { 
  conversation: InboxConversation;
  windowStatus: WindowStatus;
  onResolve?: () => void;
  onReopen?: () => void;
}) {
  const contact = conversation.contact;
  const displayName = contact?.name || 'Sem nome';
  const phone = contact?.phone ? formatPhone(contact.phone) : '';
  
  // Last interaction
  const lastInteraction = contact?.last_interaction_at
    ? formatDistanceToNow(new Date(contact.last_interaction_at), { addSuffix: true, locale: ptBR })
    : 'Nunca';
  
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        {/* Avatar with online indicator */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {(contact?.name?.[0] || contact?.phone?.[0] || '?').toUpperCase()}
            </span>
          </div>
          {windowStatus.isOpen && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
          )}
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
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {phone}
            </span>
            <span>•</span>
            <span className={windowStatus.isOpen ? 'text-green-600' : 'text-orange-600'}>
              {windowStatus.isOpen ? `Ativo ${lastInteraction}` : 'Aguardando resposta'}
            </span>
          </p>
        </div>
      </div>
      
      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conversation.status === 'open' ? (
            <DropdownMenuItem onClick={onResolve}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como resolvida
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onReopen}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Reabrir conversa
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            Bloquear contato
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-lg" />
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
      <p className="text-sm text-center max-w-xs">
        Escolha uma conversa na lista à esquerda para ver as mensagens e responder
      </p>
    </div>
  );
}

function ScrollToBottomButton({ 
  visible, 
  onClick,
  unreadCount = 0
}: { 
  visible: boolean; 
  onClick: () => void;
  unreadCount?: number;
}) {
  if (!visible) return null;
  
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="absolute bottom-24 right-6 rounded-full shadow-lg z-10 h-10 w-10"
      variant="secondary"
    >
      <ArrowDown className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge 
          variant="default" 
          className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center rounded-full text-xs px-1.5 bg-green-500"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}

export function ChatWindow({ conversation, messages, isLoading, windowStatus }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const sendMessage = useSendMessage();
  const retryMessage = useRetryMessage();
  const sendTemplate = useSendTemplate();
  
  // Templates for TemplateComposer
  const { data: tenantData } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading } = useApprovedTemplates(tenantData?.tenantId);
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, []);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);
  
  // Handle scroll to detect if user scrolled up
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isAtBottom);
    };
    
    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
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
    
    // Scroll to bottom after sending
    setTimeout(scrollToBottom, 100);
  }, [conversation, sendMessage, scrollToBottom]);
  
  // Handle retry
  const handleRetry = useCallback((message: InboxMessage) => {
    if (!conversation || !message.content) return;
    
    retryMessage.mutate({
      conversationId: conversation.id,
      originalText: message.content,
    });
  }, [conversation, retryMessage]);
  
  // Handle template send
  const handleSendTemplate = useCallback(async (templateId: string, variables: Record<string, string>) => {
    if (!conversation) return;
    
    await sendTemplate.mutateAsync({
      conversationId: conversation.id,
      templateId,
      variables,
    });
    
    // Scroll to bottom after sending
    setTimeout(scrollToBottom, 100);
  }, [conversation, sendTemplate, scrollToBottom]);
  
  if (!conversation) {
    return <EmptyState />;
  }
  
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <ChatHeader 
        conversation={conversation} 
        windowStatus={windowStatus}
      />
      
      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 min-h-full">
          {isLoading ? (
            <MessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageCircle className="w-12 h-12 opacity-50 mb-2" />
              <p className="font-medium">Nenhuma mensagem ainda</p>
              <p className="text-sm text-center mt-1">
                {windowStatus.isOpen 
                  ? 'Digite uma mensagem para iniciar a conversa'
                  : 'Envie um template para iniciar a conversa'}
              </p>
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
      
      {/* Scroll to bottom button */}
      <ScrollToBottomButton 
        visible={showScrollButton} 
        onClick={scrollToBottom}
        unreadCount={conversation.unread_count}
      />
      
      {/* Composer - Text or Template based on window status */}
      {windowStatus.isOpen ? (
        <MessageComposer
          conversationId={conversation.id}
          windowStatus={windowStatus}
          onSend={handleSend}
          isSending={sendMessage.isPending}
        />
      ) : (
        <TemplateComposer
          templates={templates}
          isLoadingTemplates={templatesLoading}
          onSend={handleSendTemplate}
          isSending={sendTemplate.isPending}
        />
      )}
    </div>
  );
}
