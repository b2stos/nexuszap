/**
 * ConversationList Component
 * 
 * Lista de conversas estilo WhatsApp Web com busca, filtros e indicadores de status
 * Suporta swipe-to-delete (mobile) e hover delete (desktop)
 */

import { Search, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { InboxConversation, ConversationFilter } from '@/types/inbox';
import { SwipeableConversationItem } from './SwipeableConversationItem';

interface ConversationListProps {
  conversations: InboxConversation[];
  isLoading: boolean;
  activeId: string | undefined;
  filter: ConversationFilter;
  onFilterChange: (filter: ConversationFilter) => void;
  onSelect: (conversation: InboxConversation) => void;
  onDeleteConversation: (conversationId: string) => void;
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
  onDeleteConversation,
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
            variant={filter.repliedOnly ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, repliedOnly: true, unreadOnly: false, status: 'all' })}
            className="flex-1 h-8"
          >
            Respondidas
          </Button>
          <Button
            variant={filter.unreadOnly ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, unreadOnly: true, repliedOnly: false, status: 'all' })}
            className="flex-1 h-8"
          >
            Não lidas
          </Button>
          <Button
            variant={!filter.repliedOnly && !filter.unreadOnly && filter.status === 'all' ? "default" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filter, status: 'all', unreadOnly: false, repliedOnly: false })}
            className="flex-1 h-8"
          >
            Todas
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
                : filter.repliedOnly
                  ? 'Nenhum contato respondeu ainda'
                  : filter.unreadOnly 
                    ? 'Todas as mensagens foram lidas'
                    : 'As conversas aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => (
              <SwipeableConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onClick={() => onSelect(conv)}
                onDelete={() => onDeleteConversation(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
