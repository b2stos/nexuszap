/**
 * ChatWindow Component
 * 
 * Área central do chat premium estilo WhatsApp Web com:
 * - Scroll inteligente (auto + botão nova mensagem)
 * - Scroll infinito para histórico
 * - Typing indicator
 * - Draft automático
 * - Quick replies
 * - Reactions
 * - Ações de conversa
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Phone, MoreVertical, MessageCircle, ArrowDown, Clock, CheckCircle2, User2, Pin, PinOff } from 'lucide-react';
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
import { TypingIndicator } from './TypingIndicator';
import { useSendMessage, useRetryMessage } from '@/hooks/useSendMessage';
import { useSendTemplate } from '@/hooks/useSendTemplate';
import { useApprovedTemplates, useCurrentTenantForTemplates } from '@/hooks/useTemplates';
import { useInboxDrafts } from '@/hooks/useInboxDrafts';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useToggleReaction, groupReactionsByEmoji, useMessageReactions } from '@/hooks/useMessageReactions';
import { useResolveConversation, useReopenConversation, useAssumeConversation, useTogglePinConversation } from '@/hooks/useConversationActions';
import { format, isSameDay, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface ChatWindowProps {
  conversation: InboxConversation | null;
  messages: InboxMessage[];
  isLoading: boolean;
  windowStatus: WindowStatus;
  tenantId?: string;
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
  onAssume,
  onTogglePin,
}: { 
  conversation: InboxConversation;
  windowStatus: WindowStatus;
  onResolve?: () => void;
  onReopen?: () => void;
  onAssume?: () => void;
  onTogglePin?: () => void;
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
            {conversation.is_pinned && (
              <Pin className="w-3 h-3 text-primary" />
            )}
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
      <div className="flex items-center gap-1">
        {/* Assume button if not assigned */}
        {!conversation.assigned_user_id && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onAssume}
            className="h-8"
          >
            <User2 className="w-4 h-4 mr-1" />
            Assumir
          </Button>
        )}
        
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
            <DropdownMenuItem onClick={onTogglePin}>
              {conversation.is_pinned ? (
                <>
                  <PinOff className="w-4 h-4 mr-2" />
                  Desafixar
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 mr-2" />
                  Fixar conversa
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Bloquear contato
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  unreadCount = 0,
  hasNewMessage = false,
}: { 
  visible: boolean; 
  onClick: () => void;
  unreadCount?: number;
  hasNewMessage?: boolean;
}) {
  if (!visible) return null;
  
  return (
    <Button
      onClick={onClick}
      size="sm"
      className="absolute bottom-24 right-6 rounded-full shadow-lg z-10 h-10 px-4 gap-2"
      variant={hasNewMessage ? "default" : "secondary"}
    >
      {hasNewMessage ? (
        <span className="text-sm">Nova mensagem</span>
      ) : null}
      <ArrowDown className="h-4 w-4" />
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

export function ChatWindow({ 
  conversation, 
  messages, 
  isLoading, 
  windowStatus,
  tenantId,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const prevMessagesLength = useRef(messages.length);
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Hooks
  const sendMessage = useSendMessage();
  const retryMessage = useRetryMessage();
  const sendTemplate = useSendTemplate();
  const resolveConversation = useResolveConversation();
  const reopenConversation = useReopenConversation();
  const assumeConversation = useAssumeConversation();
  const togglePinConversation = useTogglePinConversation();
  const toggleReaction = useToggleReaction();
  
  // Templates for TemplateComposer
  const { data: tenantData } = useCurrentTenantForTemplates();
  const { data: templates = [], isLoading: templatesLoading } = useApprovedTemplates(tenantData?.tenantId);
  
  // Drafts
  const { getDraft, setDraft, clearDraft } = useInboxDrafts();
  const currentDraft = conversation ? getDraft(conversation.id) : '';
  
  // Quick replies
  const { data: quickReplies = [] } = useQuickReplies(tenantId);
  
  // Typing indicator
  const { 
    typingText, 
    broadcastTyping, 
    stopTyping 
  } = useTypingIndicator(
    tenantId,
    conversation?.id,
    user ? { id: user.id, email: user.email || '' } : null
  );
  
  // Reactions
  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { data: allReactions = [] } = useMessageReactions(messageIds);
  
  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
        setShowScrollButton(false);
        setHasNewMessage(false);
      }
    }
  }, []);
  
  // Auto-scroll when new messages arrive (only if at bottom)
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (isAtBottom) {
        scrollToBottom();
      } else {
        setHasNewMessage(true);
        setShowScrollButton(true);
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length, isAtBottom, scrollToBottom]);
  
  // Initial scroll to bottom
  useEffect(() => {
    if (conversation?.id) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [conversation?.id]);
  
  // Handle scroll to detect if user scrolled up
  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
      setShowScrollButton(!atBottom);
      
      if (atBottom) {
        setHasNewMessage(false);
      }
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
  
  // Get reactions for a message
  const getMessageReactions = useCallback((messageId: string) => {
    return groupReactionsByEmoji(allReactions, messageId);
  }, [allReactions]);
  
  // Handle send
  const handleSend = useCallback(async (text: string) => {
    if (!conversation) return;
    
    await sendMessage.mutateAsync({
      conversationId: conversation.id,
      text,
    });
    
    // Clear draft
    clearDraft(conversation.id);
    
    // Scroll to bottom after sending
    setTimeout(() => scrollToBottom(), 100);
  }, [conversation, sendMessage, clearDraft, scrollToBottom]);
  
  // Handle draft change
  const handleDraftChange = useCallback((text: string) => {
    if (!conversation) return;
    setDraft(conversation.id, text);
  }, [conversation, setDraft]);
  
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
    setTimeout(() => scrollToBottom(), 100);
  }, [conversation, sendTemplate, scrollToBottom]);
  
  // Handle reactions
  const handleReact = useCallback((messageId: string, emoji: string) => {
    toggleReaction.mutate({ messageId, emoji });
  }, [toggleReaction]);
  
  // Handle conversation actions
  const handleResolve = useCallback(() => {
    if (conversation) {
      resolveConversation.mutate(conversation.id);
    }
  }, [conversation, resolveConversation]);
  
  const handleReopen = useCallback(() => {
    if (conversation) {
      reopenConversation.mutate(conversation.id);
    }
  }, [conversation, reopenConversation]);
  
  const handleAssume = useCallback(() => {
    if (conversation) {
      assumeConversation.mutate(conversation.id);
    }
  }, [conversation, assumeConversation]);
  
  const handleTogglePin = useCallback(() => {
    if (conversation) {
      togglePinConversation.mutate({ 
        conversationId: conversation.id, 
        isPinned: !conversation.is_pinned 
      });
    }
  }, [conversation, togglePinConversation]);
  
  if (!conversation) {
    return <EmptyState />;
  }
  
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <ChatHeader 
        conversation={conversation} 
        windowStatus={windowStatus}
        onResolve={handleResolve}
        onReopen={handleReopen}
        onAssume={handleAssume}
        onTogglePin={handleTogglePin}
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
                    reactions={getMessageReactions(item.message.id)}
                    onReact={handleReact}
                    currentUserId={user?.id}
                  />
                );
              }
              return null;
            })
          )}
          
          {/* Typing indicator at bottom of messages */}
          {typingText && (
            <div className="flex justify-start mb-2">
              <div className="bg-card border border-border rounded-lg px-3 py-2 rounded-bl-none">
                <TypingIndicator typingText={typingText} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Scroll to bottom button */}
      <ScrollToBottomButton 
        visible={showScrollButton} 
        onClick={() => scrollToBottom()}
        unreadCount={conversation.unread_count}
        hasNewMessage={hasNewMessage}
      />
      
      {/* Composer - Text or Template based on window status */}
      {windowStatus.isOpen ? (
        <MessageComposer
          conversationId={conversation.id}
          windowStatus={windowStatus}
          onSend={handleSend}
          isSending={sendMessage.isPending}
          draft={currentDraft}
          onDraftChange={handleDraftChange}
          quickReplies={quickReplies}
          onTyping={broadcastTyping}
          onStopTyping={stopTyping}
          typingText={typingText}
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
