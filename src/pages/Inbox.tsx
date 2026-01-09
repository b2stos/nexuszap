/**
 * Inbox Page
 * 
 * Página principal do Inbox estilo WhatsApp Web com 3 colunas
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import {
  useCurrentTenant,
  useConversations,
  useMessages,
  useContact,
  useMarkAsRead,
  useInboxRealtime,
  calculate24hWindow,
} from '@/hooks/useInbox';
import { InboxConversation, ConversationFilter } from '@/types/inbox';

export default function Inbox() {
  const navigate = useNavigate();
  
  // State
  const [user, setUser] = useState<User | null>(null);
  const [activeConversation, setActiveConversation] = useState<InboxConversation | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>({
    search: '',
    unreadOnly: false,
    status: 'all',
  });
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenant();
  const tenantId = tenantData?.tenantId;
  
  const { 
    data: conversations = [], 
    isLoading: conversationsLoading 
  } = useConversations(tenantId, filter);
  
  const { 
    data: messages = [], 
    isLoading: messagesLoading 
  } = useMessages(activeConversation?.id);
  
  const { 
    data: contact 
  } = useContact(activeConversation?.contact_id);
  
  const markAsRead = useMarkAsRead();
  
  // Realtime
  useInboxRealtime(
    tenantId,
    activeConversation?.id,
    useCallback(() => {
      // Play notification sound?
    }, []),
    useCallback(() => {
      // Refresh conversations
    }, [])
  );
  
  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    }
  }, [conversations, activeConversation]);
  
  // Mark as read when conversation is selected
  useEffect(() => {
    if (activeConversation && activeConversation.unread_count > 0) {
      markAsRead.mutate(activeConversation.id);
      // Update local state
      setActiveConversation(prev => prev ? { ...prev, unread_count: 0 } : null);
    }
  }, [activeConversation?.id]);
  
  // Calculate 24h window
  const windowStatus = calculate24hWindow(activeConversation?.last_inbound_at || null);
  
  // Handle conversation selection
  const handleSelectConversation = (conv: InboxConversation) => {
    setActiveConversation(conv);
  };
  
  // Loading state
  if (tenantLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  
  // No tenant state
  if (tenantError || !tenantId) {
    return (
      <DashboardLayout user={user}>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
          <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma organização encontrada</h2>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            Você precisa estar vinculado a uma organização para acessar o Inbox.
            Entre em contato com o administrador.
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout user={user}>
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
        {/* Left Column - Conversation List */}
        <div className="w-80 flex-shrink-0 border-r border-border hidden md:block">
          <ConversationList
            conversations={conversations}
            isLoading={conversationsLoading}
            activeId={activeConversation?.id}
            filter={filter}
            onFilterChange={setFilter}
            onSelect={handleSelectConversation}
          />
        </div>
        
        {/* Center Column - Chat */}
        <div className="flex-1 min-w-0">
          <ChatWindow
            conversation={activeConversation}
            messages={messages}
            isLoading={messagesLoading}
          />
        </div>
        
        {/* Right Column - Contact Panel */}
        <div className="w-80 flex-shrink-0 hidden lg:block">
          <ContactPanel
            conversation={activeConversation}
            contact={contact || activeConversation?.contact || null}
            windowStatus={windowStatus}
          />
        </div>
      </div>
      
      {/* Mobile: Conversation List as overlay when no conversation selected */}
      <div className="md:hidden">
        {!activeConversation && (
          <div className="fixed inset-0 z-50 bg-background pt-16">
            <ConversationList
              conversations={conversations}
              isLoading={conversationsLoading}
              activeId={activeConversation?.id}
              filter={filter}
              onFilterChange={setFilter}
              onSelect={handleSelectConversation}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
