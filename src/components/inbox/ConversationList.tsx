/**
 * ConversationList Component
 * 
 * Lista de conversas estilo WhatsApp Web com busca, filtros e indicadores de status
 */

import { useState } from 'react';
import { Search, Pin, MessageCircle, Clock, CheckCircle2, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { InboxConversation, ConversationFilter } from '@/types/inbox';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationListProps {
  conversations: InboxConversation[];
  isLoading: boolean;
  activeId: string | undefined;
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  onSelect: (conversation: InboxConversation) => void;
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
  // Closed/resolved
  if (conversation.status !== 'open') {
    return 'closed';
  }
  
  // Check if within 24h window (active)
  if (conversation.last_inbound_at) {
    const hoursSinceInbound = differenceInHours(new Date(), new Date(conversation.last_inbound_at));
    if (hoursSinceInbound < 24) {
      return 'active';
    }
  }
  
  // Waiting for response
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

function ConversationItem({ 
  conversation, 
  isActive, 
  onClick 
}: { 
  conversation: InboxConversation; 
  isActive: boolean;
  onClick: () => void;
}) {
  const contact = conversation.contact;
  const displayName = contact?.name || formatPhone(contact?.phone || '');
  const lastMessageTime = conversation.last_message_at 
    ? formatDistanceToNow(new Date(conversation.last_message_at), { 
        addSuffix: false, 
        locale: ptBR 
      })
    : '';
  
  const state = getConversationState(conversation);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors text-left border-b border-border/50",
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
        {/* Online indicator */}
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
            <span className={cn(
              "font-medium truncate",
              conversation.unread_count > 0 && "text-foreground",
              !conversation.unread_count && "text-muted-foreground"
            )}>
              {displayName}
            </span>
            <StateIndicator state={state} />
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {lastMessageTime}
          </span>
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            "text-sm truncate",
            conversation.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
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
    </button>
  );
}

function ConversationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 border-b border-border/50">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export function ConversationList({
  conversations,
  isLoading,
  activeId,
  filter,
  onFilterChange,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Conversas
          </h2>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={filter.search}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-1">
          <Button
            variant={filter.status === 'all' ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, status: 'all', unreadOnly: false })}
            className="flex-1 h-8"
          >
            Todas
          </Button>
          <Button
            variant={filter.unreadOnly ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, unreadOnly: true, status: 'all' })}
            className="flex-1 h-8"
          >
            Não lidas
          </Button>
          <Button
            variant={filter.status === 'open' ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, status: 'open', unreadOnly: false })}
            className="flex-1 h-8"
          >
            Ativas
          </Button>
        </div>
      </div>
      
      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div>
            {[...Array(8)].map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhuma conversa</p>
            <p className="text-sm mt-1">
              {filter.search 
                ? 'Tente outra busca' 
                : filter.unreadOnly 
                  ? 'Todas as mensagens foram lidas'
                  : 'As conversas aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onClick={() => onSelect(conv)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
